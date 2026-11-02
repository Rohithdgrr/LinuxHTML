// Explicit, single-owner server file operations. Not background sync.
import {openWorkspace, listFiles, saveFile} from './workspace.js';
const el = id => document.getElementById('project-' + id);
let token = '', opened = null, baseline = {path:'', text:''}, busy = false;
const status = msg => { el('status').textContent = msg; };
const current = () => ({path: el('path').value, text: el('text').value});
const dirty = () => { const x = current(); return x.path !== baseline.path || x.text !== baseline.text; };
const confirmReplace = () => !dirty() || confirm('Discard unsaved server editor changes?');
const setEditor = (path, text, revision = null) => { el('path').value = path; el('text').value = text; el('text').readOnly = false; baseline = {path, text}; opened = revision === null ? null : {project: el('select').value, path, revision}; };
function project() { const p = el('select').value; if (!p) throw new Error('Choose a project first.'); return p; }
function fileUrl(p, path) { return `v1/projects/${encodeURIComponent(p)}/files/${path.split('/').map(encodeURIComponent).join('/')}`; }
async function rawApi(path, options = {}) {
  if (!token) throw new Error('Connect first.');
  const response = await fetch(new URL('./api/' + path, document.baseURI), {method:options.method || 'GET', headers:{Authorization:'Bearer '+token, ...(options.contentType ? {'Content-Type':options.contentType} : {})}, body:options.body, cache:'no-store',credentials:'omit',redirect:'error'});
  if (!response.ok) { let data; try { data = await response.json(); } catch {} throw new Error(data?.error || `Server error (${response.status})`); }
  return response;
}
function downloadBlob(blob,name) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = name; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function api(path, options = {}) {
  if (!token) throw new Error('Connect first.');
  const response = await fetch(new URL('./api/' + path, document.baseURI), {method:options.method || 'GET', headers:{Authorization:'Bearer ' + token, ...(options.body ? {'Content-Type':'application/json'} : {})}, body:options.body ? JSON.stringify(options.body) : undefined, cache:'no-store', credentials:'omit', redirect:'error'});
  let data; try { data = await response.json(); } catch { throw new Error(`Invalid server response (${response.status}); check the API proxy.`); }
  if (!response.ok) throw new Error(data.error || `Server error (${response.status})`);
  return data;
}
async function action(fn) {
  if (busy) return; busy = true; el('controls').disabled = true;
  try { await fn(); } catch (e) { status(e.message || 'Request failed.'); }
  finally { el('controls').disabled = false; busy = false; }
}
async function listProjects(select = '') {
  const {projects} = await api('v1/projects'); el('select').replaceChildren(new Option('Choose a project',''));
  for (const p of projects) el('select').add(new Option(p.name,p.name));
  if (projects.some(p => p.name === select)) el('select').value = select;
}
async function listRemote() {
  const {files} = await api(`v1/projects/${encodeURIComponent(project())}/files`);
  el('files').replaceChildren(); for (const f of files) el('files').add(new Option(f.path,f.path));
}
function checkSecure() {
  if (location.protocol !== 'https:' && !['localhost','127.0.0.1','[::1]'].includes(location.hostname)) throw new Error('Use HTTPS for the server token; HTTP is allowed only on localhost.');
}
el('connect').onclick = () => action(async () => {
  checkSecure(); const candidate = el('token').value; if (!candidate) throw new Error('Enter the access token.');
  if (token && !confirmReplace()) return;
  token = candidate;
  try { await listProjects(); } catch (e) { token = ''; el('connected').hidden = true; throw e; }
  el('token').value = ''; setEditor('',''); el('files').replaceChildren(); el('connected').hidden = false; status('Connected. Choose or create a project. Token stays in memory until disconnect or reload.');
});
el('health').onclick = () => action(async () => { const data = await api('v1/status'); status(`Server storage: ${data.projects} projects, ${data.files} files, ${data.content_bytes} content bytes; database ${data.database_bytes} bytes. This is not a backup.`); });
el('disconnect').onclick = () => { if (!confirmReplace()) return; token = ''; el('token').value = ''; el('connected').hidden = true; setEditor('',''); el('files').replaceChildren(); status('Disconnected.'); };
el('create').onclick = () => action(async () => {
  if (!confirmReplace()) return;
  const name = el('new-name').value.trim(); await api('v1/projects',{method:'POST',body:{name}}); await listProjects(name); await listRemote(); setEditor('',''); el('new-name').value = ''; status(`Created project ${name}.`);
});
el('delete-empty').onclick = () => action(async () => {
  const p=project(); if (!confirmReplace()) return;
  if (!confirm(`Delete empty project ${p}? This cannot be undone.`)) return;
  await api(`v1/projects/${encodeURIComponent(p)}`,{method:'DELETE',body:{confirm:p}});
  setEditor('',''); el('files').replaceChildren(); await listProjects(); status(`Deleted empty project ${p}.`);
});
let selectedProject = '';
el('select').onfocus = () => { selectedProject = el('select').value; };
el('select').onchange = () => action(async () => {
  if (!confirmReplace()) { el('select').value = selectedProject; return; }
  setEditor('',''); el('files').replaceChildren(); selectedProject = el('select').value;
  if (selectedProject) await listRemote(); status(selectedProject ? `Opened project ${selectedProject}.` : 'Choose a project.');
});
el('refresh').onclick = () => action(async () => { await listRemote(); status('Server file list refreshed; open a file to update its revision.'); });
el('open').onclick = () => action(async () => {
  const p = project(), path = el('files').value; if (!path) throw new Error('Select a server file.'); if (!confirmReplace()) return;
  const file = await api(fileUrl(p,path));
  if ('content_base64' in file) { setEditor(path,'',file.revision); opened.binary = true; el('text').readOnly = true; status(`Opened binary file ${path}; download or delete it. Binary editing is not supported.`); }
  else { setEditor(path,file.content,file.revision); status(`Opened ${path} from server.`); }
});
el('new-file').onclick = () => { if (!confirmReplace()) return; setEditor('',''); status('New file: choose a path, then save. Existing server files will not be overwritten.'); };
el('save').onclick = () => action(async () => {
  const p = project(), {path,text} = current(); if (!path) throw new Error('Enter a file path.');
  if (opened?.binary && opened.project === p && opened.path === path) throw new Error('Binary files cannot be saved in the text editor.');
  const revision = opened && opened.project === p && opened.path === path ? opened.revision : null;
  const result = await api(fileUrl(p,path),{method:'PUT',body:{content:text,revision}});
  setEditor(path,text,result.revision); await listRemote(); status(`Saved ${path} to server.`);
});
el('move').onclick = () => action(async () => {
  const p=project(), destination=el('path').value;
  if (!opened || opened.project !== p) throw new Error('Open the server file before moving it.');
  if (!destination || destination === opened.path) throw new Error('Change the file path to the new destination first.');
  const source=opened.path;
  const data=await api(`v1/projects/${encodeURIComponent(p)}/move`,{method:'POST',body:{source,destination,revision:opened.revision}});
  opened={...opened,path:destination,revision:data.revision}; baseline.path=destination;
  await listRemote(); status(`Moved saved server file from ${source} to ${destination}. Unsaved editor content was not saved.`);
});
el('delete').onclick = () => action(async () => {
  const p = project(), path = el('path').value;
  if (!opened || opened.project !== p || opened.path !== path) throw new Error('Open the server file before deleting it.');
  if (!confirm(`Delete server file ${path}? Unsaved edits will also be lost.`)) return;
  await api(fileUrl(p,path),{method:'DELETE',body:{revision:opened.revision}}); setEditor('',''); await listRemote(); status(`Deleted ${path} from server.`);
});
const localName = () => {const name=el('local-name').value; if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(name)) throw new Error('Use a simple local filename.'); return name;};
el('from-local').onclick = () => action(async () => {
  const name = localName(); if (!confirmReplace()) return;
  const db = await openWorkspace(); try { const file = (await listFiles(db)).find(f => f.name === name); if (!file) throw new Error('Local file not found.'); setEditor(name,file.content); baseline = {path:'', text:''}; status(`Loaded saved local ${name}; it has not been sent to the server.`); } finally { db.close(); }
});
el('to-local').onclick = () => action(async () => {
  if (opened?.binary) throw new Error('Binary files cannot be copied to the text-only local workspace.');
  const name = localName(), db = await openWorkspace(); try { await saveFile(db,name,el('text').value,null); window.dispatchEvent(new Event('workspace:refresh')); status(`Saved a new local copy as ${name}.`); } finally { db.close(); }
});
el('export-archive').onclick = () => action(async () => {
  const p=project(), response=await rawApi(`v1/projects/${encodeURIComponent(p)}/archive`);
  downloadBlob(await response.blob(),p+'.zip'); status(`Exported ${p} as an unencrypted ZIP.`);
});
el('import-archive').onclick = () => action(async () => {
  const p=project(), file=el('archive-file').files?.[0];
  if (!file) throw new Error('Choose a ZIP file.');
  if (file.size > 60*1024*1024) throw new Error('ZIP file exceeds 60 MiB.');
  if (!confirm(`Import ZIP into ${p}? Existing files will not be overwritten; any conflict rejects the entire import.`)) return;
  const response=await rawApi(`v1/projects/${encodeURIComponent(p)}/archive`,{method:'POST',body:file,contentType:'application/zip'});
  const data=await response.json(); await listRemote(); el('archive-file').value=''; status(`Imported ${data.imported} files into ${p}.`);
});
el('upload').onclick = () => action(async () => {
  const p = project(), file = el('upload-file').files?.[0], path = el('path').value;
  if (!file || !path) throw new Error('Choose a file and enter a server path.');
  if (file.size > 700 * 1024) throw new Error('Files are limited to 700 KiB.');
  const bytes = new Uint8Array(await file.arrayBuffer()); let raw = '';
  for (let i = 0; i < bytes.length; i += 0x8000) raw += String.fromCharCode(...bytes.subarray(i,i+0x8000));
  await api(fileUrl(p,path),{method:'PUT',body:{content_base64:btoa(raw),revision:null}});
  await listRemote(); el('upload-file').value = ''; status(`Uploaded new binary file ${path}.`);
});
el('download').onclick = () => action(async () => {
  const p = project(), path = el('files').value; if (!path) throw new Error('Select a server file.');
  const file = await api(fileUrl(p,path)); let bytes;
  if ('content_base64' in file) { const raw = atob(file.content_base64); bytes = Uint8Array.from(raw,c=>c.charCodeAt(0)); }
  else bytes = new TextEncoder().encode(file.content);
  downloadBlob(new Blob([bytes],{type:'application/octet-stream'}),path.split('/').pop()); status(`Downloaded ${path}.`);
});
window.addEventListener('beforeunload', e => { if (dirty()) { e.preventDefault(); e.returnValue = ''; } });
