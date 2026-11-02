import {alpineBootstrap} from "./alpine-bootstrap.js";
import {openPersistentDisk} from "./persistent-disk.js";
import {getCheckpoint, putCheckpoint, deleteCheckpoint} from "./checkpoints.js";
import {openWorkspace, listFiles, saveFile, deleteFile, copyOrRenameFile} from "./workspace.js";
const status = document.querySelector('#status');
const start = document.querySelector('#acknowledge');
let vm;
const urls = [];
const startProgress = document.querySelector('#start-progress');
const setStatus = message => { status.textContent = message; if (!startProgress.hidden) startProgress.textContent = message; };

// Bound each download, including the response body, so a stalled connection
// cannot leave the start button disabled indefinitely. Integrity checks still
// apply after a successful download.
async function downloadBytes(url, name, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(url, {...options, signal:controller.signal});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.arrayBuffer();
  } catch (e) {
    const detail = e.name === 'AbortError' ? 'download timed out' : (e.message || e.name);
    throw new Error(`Could not download ${name} (${detail}). Check your connection and try again.`);
  } finally { clearTimeout(timer); }
}

async function verifiedArtifacts() {
  const manifestBytes = await downloadBytes('./manifest-base.json', 'VM manifest', {cache:'no-store'});
  let manifest;
  try { manifest = JSON.parse(new TextDecoder().decode(manifestBytes)); }
  catch { throw new Error('Invalid VM manifest. Reload the app or try again later.'); }
  if (!['buildroot', 'alpine'].includes(manifest.guest)) throw new Error('Unsupported guest image');
  const guestImage = manifest.guest === 'alpine' ? 'alpine-virt-3.24.3-x86.iso' : 'buildroot-bzimage68.bin';
  const names = ['libv86.js', 'v86.wasm', 'v86-fallback.wasm', 'seabios.bin', 'vgabios.bin', guestImage, 'xterm.js', 'xterm.css', 'addon-fit.js'];
  if (manifest.guest === 'alpine') names.push('alpine-data-ext2.img.gz');
  const result = {guest: manifest.guest};
  for (const [index, name] of names.entries()) {
    setStatus(`Loading and verifying Linux component ${index + 1} of ${names.length}: ${name}…`);
    const info = manifest.artifacts?.[name];
    if (!info || info.file !== `assets/${name}` || !/^[a-f0-9]{64}$/.test(info.sha256)) throw new Error(`Invalid manifest entry: ${name}`);
    const data = await downloadBytes(`./${info.file}`, name, {cache:'no-cache'});
    const digest = await crypto.subtle.digest('SHA-256', data);
    const hash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
    if (hash !== info.sha256) throw new Error(`Integrity check failed: ${name}`);
    result[name] = data;
  }
  result.fingerprint = names.map(name => `${name}:${manifest.artifacts[name].sha256}`).join('|') + `|vm-config-v1:guest=${manifest.guest}:ram=${manifest.guest === 'alpine' ? 512 : 256}:vga=8`;
  return result;
}
function blobUrl(data, type = 'application/octet-stream') {
  const url = URL.createObjectURL(new Blob([data], { type })); urls.push(url); return url;
}
async function loadVerifiedScript(bytes) {
  const script = document.createElement('script');
  script.src = blobUrl(bytes, 'text/javascript');
  await new Promise((resolve, reject) => { script.onload = resolve; script.onerror = () => reject(new Error('Cannot load required terminal or emulator script')); document.head.append(script); });
}
async function startVM() {
  start.disabled = true;
  startProgress.hidden = false;
  startProgress.textContent = 'Preparing Linux…';
  window.linuxhtmlGuestReady = false;
  let terminal, resizeObserver, persistentDisk;
  document.querySelector('#start-error').textContent = '';
  try {
    setStatus('Verifying downloaded VM artifacts…');
    const assets = await verifiedArtifacts();
    let snapshot = null;
    if (document.querySelector('#restore-checkpoint').checked) {
      if (assets.guest === 'alpine') throw new Error('Alpine checkpoint restore is not supported in this preview.');
      setStatus('Loading local checkpoint…');
      snapshot = await getCheckpoint(assets.guest);
      if (!snapshot || !(snapshot.state instanceof Blob || snapshot.state instanceof ArrayBuffer)) throw new Error('No saved checkpoint for this guest. Uncheck restore to start fresh.');
      if (snapshot.fingerprint !== assets.fingerprint) throw new Error('Checkpoint is incompatible with these VM artifacts. Uncheck restore to start fresh.');
      if (snapshot.encoding === 'gzip') {
        if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot decompress the saved checkpoint.');
        snapshot.state = await new Response(snapshot.state.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
      } else if (snapshot.state instanceof Blob) snapshot.state = await snapshot.state.arrayBuffer();
      if (!snapshot.state.byteLength) throw new Error('Checkpoint is empty. Uncheck restore to start fresh.');
    }
    if (assets.guest === 'alpine') {
      setStatus('Opening the browser-backed Alpine data disk…');
      persistentDisk = await openPersistentDisk(assets['alpine-data-ext2.img.gz'], error => {
        window.linuxhtmlGuestReady = false;
        setStatus(`PERSISTENT DISK ERROR: ${error.message || error.name || 'storage failure'}. The VM is stopping to avoid acknowledging failed writes. Do not rely on unsaved data.`);
        vm?.stop();
      });
      window.linuxhtmlPersistentDisk = persistentDisk;
    }
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = blobUrl(assets['xterm.css'], 'text/css'); document.head.append(css);
    await loadVerifiedScript(assets['xterm.js']);
    await loadVerifiedScript(assets['addon-fit.js']);
    await loadVerifiedScript(assets['libv86.js']);
    if (typeof window.V86 !== 'function' || typeof window.Terminal !== 'function' || typeof window.FitAddon?.FitAddon !== 'function') throw new Error('Required emulator or terminal export is missing');
    document.querySelector('#first-run').hidden = true;
    startProgress.hidden = true;
    document.querySelector('#vm-section').hidden = false;
    const bootStart = performance.now();
    const container = document.querySelector('#terminal-container');
    terminal = new window.Terminal({cursorBlink:true, fontFamily:'ui-monospace, Menlo, Consolas, monospace', fontSize:14, scrollback:5000, theme:{background:'#0c1929', foreground:'#d4e4e8', cursor:'#95ded1', selectionBackground:'#365b6c'}});
    const fit = new window.FitAddon.FitAddon(); terminal.loadAddon(fit); terminal.open(container);
    const fitTerminal = () => { if (container.clientWidth && container.clientHeight) { try { fit.fit(); } catch(e) { console.warn('Terminal resize unavailable', e); } } };
    requestAnimationFrame(fitTerminal);
    resizeObserver = new ResizeObserver(fitTerminal); resizeObserver.observe(container);
    window.linuxhtmlTerminal = terminal;
    setStatus('Starting emulator — waiting for Linux');
    vm = new window.V86({
      wasm_path: blobUrl(assets['v86.wasm'], 'application/wasm'),
      memory_size: (assets.guest === 'alpine' ? 512 : 256) * 1024 * 1024, vga_memory_size: 8 * 1024 * 1024,
      screen_container: document.querySelector('#screen_container'), disable_keyboard: true,
      bios: { buffer: assets['seabios.bin'] }, vga_bios: { buffer: assets['vgabios.bin'] },
      ...(assets.guest === 'alpine'
        ? {cdrom: {buffer: assets['alpine-virt-3.24.3-x86.iso']}, hda:persistentDisk, boot_order: 0x123}
        : {bzimage: {buffer: assets['buildroot-bzimage68.bin']}, cmdline: 'tsc=reliable'}),
      filesystem: {}, ...(snapshot ? {initial_state:{buffer:snapshot.state}} : {}), autostart: true,
    });
    window.linuxhtmlVM = vm;
    if (persistentDisk) {
      const exportButton=document.querySelector('#disk-export'), importButton=document.querySelector('#disk-import-button'), importInput=document.querySelector('#disk-import'), storageButton=document.querySelector('#disk-storage');
      exportButton.hidden=false; importButton.hidden=false; storageButton.hidden=false;
      importButton.onclick=()=>importInput.click();
      storageButton.onclick=async()=>{
        try {
          if(!navigator.storage?.estimate) throw new Error('Storage estimates are unavailable');
          const info=await navigator.storage.estimate(); let retained=false;
          if(navigator.storage.persisted) retained=await navigator.storage.persisted();
          if(!retained && navigator.storage.persist && confirm('Ask the browser to protect this site’s storage from automatic eviction? This does not prevent manual clearing and does not replace backups.')) retained=await navigator.storage.persist();
          setStatus(`Browser origin storage: ${(info.usage/1048576).toFixed(1)} MiB used of approximately ${(info.quota/1048576).toFixed(0)} MiB. Eviction protection: ${retained ? 'granted' : 'not granted or unsupported'}. This is not a backup.`);
        } catch(e){setStatus(`Storage status unavailable: ${e.message || e.name}`);}
      };
      let diskBusy=false;
      exportButton.onclick=async()=>{
        if(diskBusy)return;
        if(!confirm('Export the entire persistent disk as an unencrypted gzip backup? First run sync; exit in the persistent shell, then unmount as described in the README. A mounted filesystem may produce an inconsistent backup. Continue only after unmounting.'))return;
        diskBusy=true;exportButton.disabled=true;importButton.disabled=true;importInput.disabled=true;let stopped=false;
        try {
          if(typeof CompressionStream!=='function')throw new Error('This browser cannot compress disk backups.');
          setStatus('Pausing VM and exporting disk…');await vm.stop();stopped=true;await persistentDisk.idle();
          const blob=await new Response(persistentDisk.exportStream().pipeThrough(new CompressionStream('gzip'))).blob();
          const url=URL.createObjectURL(blob), link=document.createElement('a');link.href=url;link.download='linuxhtml-alpine-disk.img.gz';link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
          setStatus(`Exported ${(blob.size/1048576).toFixed(1)} MiB. Backup is unencrypted; restart to re-enter the persistent root.`);
        } catch(e){setStatus(`Disk export failed: ${e.message || e.name}`);}
        finally{if(stopped&&!persistentDisk.failed){try{await vm.run();}catch(e){setStatus(`Could not resume VM: ${e.message || e.name}`);}}diskBusy=false;exportButton.disabled=false;importButton.disabled=false;importInput.disabled=false;}
      };
      importInput.onchange=async()=>{
        const file=importInput.files?.[0];if(!file || diskBusy)return;
        if(!confirm('Replace the entire persistent disk with this backup? Current persistent files will be lost. First run sync; exit in the persistent shell, then unmount as described in the README. Only import a trusted backup. The VM will stop and must reload.')){importInput.value='';return;}
        diskBusy=true;exportButton.disabled=true;importButton.disabled=true;importInput.disabled=true;let stopped=false,committed=false;
        try {
          setStatus('Pausing VM and validating disk backup…');await vm.stop();stopped=true;await persistentDisk.idle();
          await persistentDisk.importImage(file);committed=true;window.linuxhtmlGuestReady=false;
          try { await vm.destroy(); } finally { persistentDisk.close(); }
          setStatus('Disk restored. The VM is stopped; reload the page to use the restored disk.');
        }catch(e){setStatus(committed ? `Disk was restored, but VM shutdown failed (${e.message || e.name}). Reload immediately; do not continue this VM.` : `Disk import failed: ${e.message || e.name}`);}
        finally{if(stopped&&!committed&&!persistentDisk.failed){try{await vm.run();}catch(e){setStatus(`Could not resume VM: ${e.message || e.name}`);}}diskBusy=false;exportButton.disabled=committed;importButton.disabled=committed;importInput.disabled=committed;importInput.value='';}
      };
    }
    let preparingDisk = false, mountResult = null, persistentShellExited = false;
    terminal.onData(data => { if (!preparingDisk) vm?.serial0_send(data); });
    // Fit adjusts the browser display; guest serial PTY dimensions are not synchronized.
    vm.add_listener('emulator-ready', () => { if (!snapshot) setStatus('Emulator running — waiting for Linux shell'); });
    vm.add_listener('emulator-loaded', () => { if (snapshot) setStatus('Checkpoint restored. Press Enter in the terminal to redisplay the shell prompt.'); });
    let checkpointBusy = false;
    document.querySelector('#save-checkpoint').onclick = async () => {
      if (checkpointBusy) return;
      if (assets.guest === 'alpine') { setStatus('Alpine checkpoints are unavailable in this preview.'); return; }
      if (!window.linuxhtmlGuestReady) { setStatus('Wait for the shell prompt before saving a checkpoint.'); return; }
      if (!confirm('Save a checkpoint of the entire running VM in this browser? It can be very large and contains unencrypted memory, secrets and guest files. It replaces the previous checkpoint for this guest. Close running programs and run sync first.')) return;
      checkpointBusy = true;
      document.querySelector('#save-checkpoint').disabled = true;
      document.querySelector('#delete-checkpoint').disabled = true;
      let stopped = false;
      try {
        setStatus('Pausing VM and saving checkpoint…'); await vm.stop(); stopped = true;
        const state = await vm.save_state();
        let blob = new Blob([state]), encoding = 'raw';
        if (typeof CompressionStream === 'function') {
          setStatus('Compressing checkpoint…');
          blob = await new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).blob(); encoding = 'gzip';
        }
        await putCheckpoint({guest:assets.guest, fingerprint:assets.fingerprint, state:blob, encoding, savedAt:Date.now()});
        setStatus(`Saved a ${(blob.size / 1048576).toFixed(1)} MiB unencrypted checkpoint in this browser. It may be evicted; export important files separately.`);
      } catch (e) { setStatus(`Checkpoint failed: ${e.message || e.name || "storage error"}`); }
      finally {
        if (stopped) { try { await vm.run(); } catch (e) { setStatus(`Could not resume VM: ${e.message}`); } }
        checkpointBusy = false; document.querySelector('#save-checkpoint').disabled = false; document.querySelector('#delete-checkpoint').disabled = false;
      }
    };
    document.querySelector('#delete-checkpoint').onclick = async () => {
      if (assets.guest === 'alpine') { setStatus('Alpine checkpoints are unavailable in this preview.'); return; }
      if (checkpointBusy || !confirm('Delete the saved checkpoint for this guest? This does not change the running VM.')) return;
      checkpointBusy = true; document.querySelector('#save-checkpoint').disabled = true; document.querySelector('#delete-checkpoint').disabled = true;
      try { await deleteCheckpoint(assets.guest); setStatus('Saved checkpoint deleted.'); }
      catch (e) { setStatus(`Could not delete checkpoint: ${e.message || e.name || "storage error"}`); }
      finally { checkpointBusy = false; document.querySelector('#save-checkpoint').disabled = false; document.querySelector('#delete-checkpoint').disabled = false; }
    };
    const delay = assets.guest === 'alpine' ? 180000 : 60000;
    const warningTimer = setTimeout(() => setStatus('Linux shell not detected yet; the VM may still be starting. Alpine requires root login. You can restart.'), delay);
    let promptBuffer = '', pendingBytes = [], scheduled = false;
    const flush = () => { scheduled = false; if (pendingBytes.length) { terminal.write(new Uint8Array(pendingBytes)); pendingBytes = []; } };
    vm.add_listener('serial0-output-byte', byte => {
      pendingBytes.push(byte);
      if (pendingBytes.length >= 8192) flush();
      if (!scheduled) { scheduled = true; requestAnimationFrame(flush); }
      if (assets.guest === 'alpine' && window.linuxhtmlGuestReady && !persistentShellExited) {
        promptBuffer = (promptBuffer + String.fromCharCode(byte)).slice(-512);
        if (/\n__LH_ROOT_EXITED__\r?\n/.test(promptBuffer)) {
          persistentShellExited = true;window.linuxhtmlGuestReady=false;
          setStatus('Persistent shell exited. This live shell is temporary. Unmount the disk before export, or restart to re-enter persistent root.');
        }
      }
      if (!window.linuxhtmlGuestReady && !persistentShellExited) {
        promptBuffer = (promptBuffer + String.fromCharCode(byte)).slice(-512);
        if (assets.guest === 'alpine' && promptBuffer.includes('localhost login:')) setStatus('Alpine is ready for login: enter root and press Enter.');
        if (assets.guest === 'alpine' && !preparingDisk && mountResult === null && promptBuffer.includes('localhost:~# ')) {
          preparingDisk = true; promptBuffer = '';
          setStatus('Preparing persistent Alpine root…');
          const name='linuxhtml-bootstrap-'+Array.from(crypto.getRandomValues(new Uint8Array(8)),n=>n.toString(16).padStart(2,'0')).join('')+'.sh';
          vm.create_file('/'+name,new TextEncoder().encode(alpineBootstrap)).then(()=>{
            vm.serial0_send(`mount -t 9p -o trans=virtio,version=9p2000.L host9p /mnt && sh /mnt/${name} || echo __LH_ROOT_FAILED__\n`);
          }).catch(error=>{preparingDisk=false;mountResult=false;setStatus(`Persistent root setup failed: ${error.message || error.name}`);});
        }
        if (assets.guest === 'alpine' && preparingDisk) {
          if (/\n__LH_ROOT_READY__\r?\n/.test(promptBuffer)) {
            mountResult=true;preparingDisk=false;window.linuxhtmlGuestReady=true;clearTimeout(warningTimer);
            setStatus('Persistent overlay root ready. Runtime mounts and /mnt are temporary. Run sync before restart; export backups regularly.');
          } else if (/\n__LH_ROOT_FAILED__\r?\n/.test(promptBuffer)) {
            mountResult=false;preparingDisk=false;clearTimeout(warningTimer);setStatus('Persistent root setup failed. The current live shell is temporary; do not rely on unsaved data.');
          }
        }
        if (assets.guest !== 'alpine' && promptBuffer.includes('~% ')) {
          window.linuxhtmlGuestReady = true; clearTimeout(warningTimer);
          setStatus(`Linux shell ready (${((performance.now() - bootStart) / 1000).toFixed(1)} s); guest storage is temporary`);
        }
      }
    });
    // The separate input is a reliable way to invoke mobile software keyboards;
    // the xterm console remains available for interactive full-screen programs.
    const mobileInput = document.querySelector('#mobile-command');
    document.querySelector('#mobile-command-form').onsubmit = event => {
      event.preventDefault();
      if (preparingDisk) { setStatus('Please wait for persistent root setup to finish.'); return; }
      vm.serial0_send(mobileInput.value + '\r');
      mobileInput.value = '';
      mobileInput.focus({preventScroll:true});
    };
    document.querySelectorAll('[data-terminal-key]').forEach(button => {
      button.onclick = () => {
        if (preparingDisk) { setStatus('Please wait for persistent root setup to finish.'); return; }
        const keys = {interrupt:'\x03', tab:'\t', up:'\x1b[A', enter:'\r'};
        vm.serial0_send(keys[button.dataset.terminalKey]);
      };
    });
    document.querySelector('#terminal-focus').onclick = () => terminal.focus();
    document.querySelector('#terminal-copy').onclick = async () => {
      const selection = terminal.getSelection();
      if (!selection) { setStatus('Select terminal text first, then choose Copy selection.'); return; }
      try { await navigator.clipboard.writeText(selection); setStatus('Terminal selection copied.'); }
      catch { setStatus('Clipboard unavailable; select text and use your browser copy shortcut.'); }
    };
    document.querySelector('#terminal-paste').onclick = async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (!text) { setStatus('Clipboard is empty.'); return; }
        if (/[\r\n]/.test(text) && !confirm('The clipboard contains line breaks. Pasting may execute commands. Continue?')) return;
        terminal.paste(text); terminal.focus();
      } catch { setStatus('Clipboard access unavailable; use your browser paste shortcut.'); }
    };
    document.querySelectorAll('[data-open="terminal"]').forEach(button => button.addEventListener('click', () => requestAnimationFrame(fitTerminal)));
    terminal.focus();
  } catch (error) {
    console.error(error);
    resizeObserver?.disconnect();
    terminal?.dispose();
    persistentDisk?.close();
    startProgress.hidden = true;
    document.querySelector('#start-error').textContent = `Start failed: ${error.message}`;
    setStatus(`Start failed: ${error.message}`);
    document.querySelector('#first-run').hidden = false;
    document.querySelector('#vm-section').hidden = true;
    start.disabled = false;
  }
}

start.addEventListener('click', startVM);
document.querySelector('#restart').addEventListener('click', () => {
  if (confirm('Restart the VM? Temporary guest state and unsaved text will be lost. Saved local files, the Alpine /persist disk and any checkpoint remain unless cleared or evicted. Run sync before restarting.')) location.reload();
});
function validName(value) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value) || value === '.' || value === '..') throw new Error('Use a simple file name (letters, numbers, dot, underscore, hyphen).');
  return value;
}
function filename() { return validName(document.querySelector('#filename').value); }
let workspace;
let listedRevisions = new Map();
let cachedFiles = [];
let openedFile = null; // {name, revision}; null means a new filename
const feedback = document.querySelector('#file-status');
const nameInput = document.querySelector('#filename');
const textInput = document.querySelector('#filecontent');
let editorBaseline = {name: nameInput.value, content: textInput.value};
function acceptReplacement() {
  if (nameInput.value === editorBaseline.name && textInput.value === editorBaseline.content) return true;
  return confirm('Replace the current editor content? Unsaved changes will be lost.');
}
function markEditorSaved() { editorBaseline = {name: nameInput.value, content: textInput.value}; }
window.addEventListener('beforeunload', event => {
  if (nameInput.value !== editorBaseline.name || textInput.value !== editorBaseline.content) {
    event.preventDefault(); event.returnValue = '';
  }
});
window.addEventListener('workspace:template', event => {
  const {name, content} = event.detail || {};
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(name) || typeof content !== 'string' || !acceptReplacement()) { event.preventDefault(); return; }
  nameInput.value = name; textInput.value = content; openedFile = null;
  feedback.textContent = `Template ${name} opened. Save locally to keep it; existing files are never overwritten without opening them first.`;
});
function renderFileList() {
  const select = document.querySelector('#file-list');
  const previous = select.value;
  const query = document.querySelector('#file-search').value.trim().toLocaleLowerCase();
  const matching = cachedFiles.filter(file => file.name.toLocaleLowerCase().includes(query));
  select.replaceChildren(new Option('Choose a file', ''));
  for (const file of matching) select.add(new Option(file.name, file.name));
  if (matching.some(file => file.name === previous)) select.value = previous;
  document.querySelector('#file-count').textContent = `${matching.length} / ${cachedFiles.length}`;
}
async function refreshFiles() {
  const files = await listFiles(workspace);
  listedRevisions = new Map(files.map(file => [file.name, file.revision ?? 0]));
  cachedFiles = files.sort((a, b) => a.name.localeCompare(b.name));
  renderFileList();
}
document.querySelector('#file-search').addEventListener('input', renderFileList);

const workspaceReady = openWorkspace().then(async db => {
  workspace = db;
  db.onversionchange = () => { db.close(); workspace = null; feedback.textContent = 'Workspace closed for upgrade; reload this page.'; };
  await refreshFiles();
}).catch(e => { feedback.textContent = 'Local workspace unavailable: ' + e.message; });
window.addEventListener('workspace:refresh', async () => {
  try { await workspaceReady; if (workspace) await refreshFiles(); } catch (e) { feedback.textContent = 'Workspace refresh failed: ' + e.message; }
});
async function requireWorkspace() {
  await workspaceReady;
  if (!workspace) throw new Error('Local workspace is unavailable');
  return workspace;
}
document.querySelector('#save-local').addEventListener('click', async () => {
  try { const db = await requireWorkspace(); const name = filename(); const expected = openedFile?.name === name ? openedFile.revision : null; const content = textInput.value; const saved = await saveFile(db, name, content, expected); openedFile = {name, revision: saved.revision}; editorBaseline = {name, content}; await refreshFiles(); document.querySelector('#file-list').value = name; feedback.textContent = `Saved ${name} in this browser. Export important files as backup.`; window.dispatchEvent(new Event('workspace:refresh')); }
  catch (e) { feedback.textContent = 'Save failed: ' + e.message; }
});
document.querySelector('#load-local').addEventListener('click', async () => {
  try { const db = await requireWorkspace(); const name = document.querySelector('#file-list').value; const file = (await listFiles(db)).find(item => item.name === name); if (!file) throw new Error('Select a saved file'); if (!acceptReplacement()) return; document.querySelector('#filename').value = file.name; document.querySelector('#filecontent').value = file.content; openedFile = {name: file.name, revision: file.revision ?? 0}; markEditorSaved(); feedback.textContent = `Opened ${file.name}.`; }
  catch (e) { feedback.textContent = 'Open failed: ' + e.message; }
});
document.querySelector('#delete-local').addEventListener('click', async () => {
  try { const db = await requireWorkspace(); const name = document.querySelector('#file-list').value; if (!name) throw new Error('Select a saved file'); if (!confirm(`Delete local file ${name}?`)) return; await deleteFile(db, name, listedRevisions.get(name)); if (openedFile?.name === name) openedFile = null; await refreshFiles(); feedback.textContent = `Deleted ${name} from local storage.`; window.dispatchEvent(new Event('workspace:refresh')); }
  catch (e) { feedback.textContent = 'Delete failed: ' + e.message; if (workspace) await refreshFiles(); }
});
async function operateOnFile(rename) {
  try {
    const db = await requireWorkspace();
    const source = document.querySelector('#file-list').value;
    if (!source) throw new Error('Select a saved file first.');
    const target = validName(document.querySelector('#file-target-name').value.trim());
    if (source === target) throw new Error('Choose a different destination name.');
    // Notes have a reserved identity: changing it would hide them from Notes.
    if (/^lnote-[a-f0-9]{24}\.txt$/.test(source) || /^lnote-[a-f0-9]{24}\.txt$/.test(target)) throw new Error('Manage note files in the Notes app instead.');
    const record = await copyOrRenameFile(db, source, target, listedRevisions.get(source), rename);
    if (rename && openedFile?.name === source) {
      openedFile = {name: target, revision: record.revision};
      if (nameInput.value === source) nameInput.value = target;
      if (editorBaseline.name === source) editorBaseline.name = target;
    }
    document.querySelector('#file-search').value = '';
    await refreshFiles();
    document.querySelector('#file-list').value = target;
    document.querySelector('#file-target-name').value = '';
    feedback.textContent = rename ? `Renamed ${source} to ${target}.` : `Duplicated the saved version of ${source} as ${target}. Unsaved editor changes were not copied.`;
    window.dispatchEvent(new Event('workspace:refresh'));
  } catch (e) { feedback.textContent = `${rename ? 'Rename' : 'Duplicate'} failed: ${e.message}`; }
}
document.querySelector('#rename-local').addEventListener('click', () => operateOnFile(true));
document.querySelector('#copy-local').addEventListener('click', () => operateOnFile(false));
document.querySelector('#export-file').addEventListener('click', () => {
  try { const name = filename(); const url = URL.createObjectURL(new Blob([document.querySelector('#filecontent').value], {type:'text/plain;charset=utf-8'})); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); feedback.textContent = `Exported ${name}.`; }
  catch (e) { feedback.textContent = 'Export failed: ' + e.message; }
});
document.querySelector('#import-file').addEventListener('change', async event => {
  try {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(file.name)) throw new Error('Unsupported filename; use letters, numbers, dot, underscore or hyphen.');
    if (file.size > 1024 * 1024) throw new Error('Text imports are limited to 1 MiB.');
    const text = new TextDecoder('utf-8', {fatal: true}).decode(await file.arrayBuffer());
    if (!acceptReplacement()) return;
    document.querySelector('#filename').value = file.name;
    document.querySelector('#filecontent').value = text;
    openedFile = null;
    feedback.textContent = `Imported ${file.name} into the editor; choose Save locally to persist it.`;
  } catch (e) { feedback.textContent = 'Import failed: ' + e.message; }
  finally { event.target.value = ''; }
});
document.querySelector('#send-file').addEventListener('click', async () => {
  try { if (!vm) throw new Error('Start the Linux VM from Terminal first'); await vm.create_file('/' + filename(), new TextEncoder().encode(document.querySelector('#filecontent').value)); document.querySelector('#file-status').textContent = 'Sent to /mnt/' + filename() + ' (temporary)'; }
  catch (e) { document.querySelector('#file-status').textContent = 'Send failed: ' + e.message; }
});
document.querySelector('#read-file').addEventListener('click', async () => {
  try { if (!vm) throw new Error('Start the Linux VM from Terminal first'); const data = await vm.read_file('/' + filename()); if (!acceptReplacement()) return; document.querySelector('#filecontent').value = new TextDecoder().decode(data); document.querySelector('#file-status').textContent = 'Read /mnt/' + filename(); }
  catch (e) { document.querySelector('#file-status').textContent = 'Read failed: ' + e.message; }
});
// Update prompts never force activation or reload: other tabs and a running VM
// must keep their current asset version until the user has saved their work.
const updateStatus = document.querySelector('#app-update-status');
const updateBadge = document.querySelector('#update-badge');
const updateButton = document.querySelector('#check-app-update');
let registration;
function showUpdateWaiting() {
  updateBadge.hidden = false;
  updateStatus.textContent = 'An update is ready. Save your files, back up important work, and stop the VM. Close all LinuxHTML tabs or installed app windows, then reopen the app to apply it.';
}
function observeUpdate(reg) {
  if (reg.waiting && navigator.serviceWorker.controller) showUpdateWaiting();
  reg.addEventListener('updatefound', () => {
    const worker = reg.installing;
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdateWaiting();
      else if (worker.state === 'redundant' && updateBadge.hidden) updateStatus.textContent = 'Update download failed. Check your connection and try again.';
    });
  });
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', {updateViaCache:'none'}).then(reg => {
    registration = reg; observeUpdate(reg);
    if (updateBadge.hidden) updateStatus.textContent = 'Offline app registered. Updates are checked when the app opens.';
  }).catch(e => { updateStatus.textContent = `Offline app unavailable: ${e.message || e.name}. Check your browser settings and connection.`; });
} else updateStatus.textContent = 'Offline app updates are not supported in this browser or connection.';
updateButton.addEventListener('click', async () => {
  if (!registration) { updateStatus.textContent = 'Offline app is not available yet. Try again or reopen the app.'; return; }
  updateButton.disabled = true;
  try {
    updateStatus.textContent = 'Checking for updates…';
    await registration.update();
    if (registration.waiting && navigator.serviceWorker.controller) showUpdateWaiting();
    else if (registration.installing) updateStatus.textContent = 'An update is downloading. Keep this app open until the check finishes.';
    else updateStatus.textContent = 'Update check complete. No update is waiting.';
  } catch (e) { updateStatus.textContent = `Update check failed: ${e.message || e.name}. Check your connection and try again.`; }
  finally { updateButton.disabled = false; }
});
const storageStatus = document.querySelector('#browser-storage-status');
async function describeBrowserStorage(requestProtection = false) {
  if (!navigator.storage) { storageStatus.textContent = 'Browser storage information is unavailable. Export important work.'; return; }
  try {
    let protection = null;
    if (requestProtection) {
      if (!navigator.storage.persist) { storageStatus.textContent = 'This browser cannot request storage protection. Export important work.'; return; }
      protection = await navigator.storage.persist();
    } else if (navigator.storage.persisted) protection = await navigator.storage.persisted();
    let estimate = '';
    if (navigator.storage.estimate) {
      const info = await navigator.storage.estimate();
      if (Number.isFinite(info.usage) && Number.isFinite(info.quota)) estimate = ` Approximately ${(info.usage / 1048576).toFixed(1)} MiB used of ${(info.quota / 1048576).toFixed(0)} MiB available to this origin.`;
    }
    const label = protection === true ? 'Storage protection granted' : protection === false ? 'Storage protection not granted' : 'Storage protection status unavailable';
    storageStatus.textContent = `${label}.${estimate} This is not a backup; browser data can still be cleared.`;
  } catch (e) { storageStatus.textContent = `Storage status unavailable: ${e.message || e.name}. Export important work.`; }
}
document.querySelector('#check-browser-storage').addEventListener('click', () => describeBrowserStorage());
document.querySelector('#request-browser-storage').addEventListener('click', () => describeBrowserStorage(true));
