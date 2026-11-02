import {openWorkspace, listFiles, restoreNewFiles} from './workspace.js';
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 500;
const message = document.querySelector('#backup-status');
const exportButton = document.querySelector('#backup-export');
const restoreInput = document.querySelector('#backup-import');
const encoder = new TextEncoder();

function validateBackup(value) {
  if (!value || typeof value !== 'object' || value.format !== 'linuxhtml-workspace' || value.version !== 1 || !Array.isArray(value.files)) throw new Error('Unsupported or invalid backup format.');
  if (value.files.length > MAX_FILES) throw new Error(`Backup contains more than ${MAX_FILES} files.`);
  const seen = new Set();
  const files = [];
  let total = 0;
  for (const file of value.files) {
    if (!file || typeof file !== 'object' || typeof file.name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(file.name) || typeof file.content !== 'string') throw new Error('Backup contains an invalid filename or non-text file.');
    if (seen.has(file.name)) throw new Error(`Duplicate filename in backup: ${file.name}`);
    seen.add(file.name);
    total += encoder.encode(file.content).byteLength;
    if (total > MAX_BYTES) throw new Error('Backup text exceeds the 5 MiB limit.');
    files.push({name:file.name, content:file.content});
  }
  return files;
}
exportButton.addEventListener('click', async () => {
  exportButton.disabled = true;
  let db;
  try {
    db = await openWorkspace();
    const files = (await listFiles(db)).map(({name, content}) => ({name, content}));
    const data = {format:'linuxhtml-workspace', version:1, exportedAt:new Date().toISOString(), files};
    validateBackup(data);
    const json = JSON.stringify(data, null, 2);
    if (encoder.encode(json).byteLength > MAX_BYTES) throw new Error('Backup exceeds the 5 MiB limit. Export individual files instead.');
    const url = URL.createObjectURL(new Blob([json], {type:'application/json'}));
    const link = document.createElement('a'); link.href = url; link.download = 'linuxhtml-workspace-backup.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    message.textContent = `Exported ${files.length} local text file${files.length === 1 ? '' : 's'}. Keep this unencrypted backup somewhere safe.`;
  } catch (e) { message.textContent = 'Backup failed: ' + e.message; }
  finally { db?.close(); exportButton.disabled = false; }
});
restoreInput.addEventListener('change', async event => {
  let db;
  try {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) throw new Error('Backup exceeds the 5 MiB limit.');
    let data;
    try { data = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(await file.arrayBuffer())); }
    catch { throw new Error('Backup is not valid UTF-8 JSON.'); }
    const files = validateBackup(data);
    if (!files.length) { message.textContent = 'Backup contains no files; nothing to restore.'; return; }
    if (!confirm(`Restore ${files.length} local text file(s)? Existing files will not be overwritten. If any names conflict, nothing will be imported.`)) { message.textContent = 'Restore cancelled; no files were changed.'; return; }
    db = await openWorkspace();
    await restoreNewFiles(db, files);
    message.textContent = `Restored ${files.length} local text file${files.length === 1 ? '' : 's'}. Open Files & editor to use them.`;
    window.dispatchEvent(new Event('workspace:refresh'));
  } catch (e) { message.textContent = 'Restore failed: ' + e.message; }
  finally { db?.close(); event.target.value = ''; }
});
