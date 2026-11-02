import {openWorkspace, listFiles, saveFile, deleteFile} from './workspace.js';
const $ = id => document.getElementById(id);
const notePattern = /^lnote-[a-f0-9]{24}\.txt$/;
let db, selected = null, baseline = '', notes = [];
let pending = false;
const text = $('note-text'), feedback = $('note-status');
function title(content) { return content.split(/\r?\n/).find(line => line.trim())?.trim().slice(0, 70) || 'Untitled note'; }
function dirty() { return text.value !== baseline; }
function confirmDiscard() { return !dirty() || confirm('Discard unsaved changes to this note?'); }
function makeName() { return 'lnote-' + Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2,'0')).join('') + '.txt'; }
function updateEditor() {
  $('note-editor-title').textContent = selected ? title(text.value) : 'New note';
  $('note-editor-subtitle').textContent = selected ? 'Saved local note' : 'Not saved yet';
  $('note-dirty').hidden = !dirty();
  $('note-delete').disabled = pending || !db || !selected;
  $('note-save').disabled = pending || !db;
  $('note-new').disabled = pending || !db;
}
function renderList() {
  const list = $('note-list'); list.replaceChildren();
  const search = $('note-search').value.trim().toLocaleLowerCase();
  const shown = notes.filter(note => note.content.toLocaleLowerCase().includes(search));
  $('note-count').textContent = String(notes.length);
  $('note-empty').hidden = shown.length > 0;
  $('note-empty').textContent = notes.length && search ? 'No notes match your search.' : 'No saved notes yet. Your next good idea starts here.';
  for (const note of shown) {
    const button = document.createElement('button'); button.className = 'note-item' + (selected?.name === note.name ? ' selected' : '');
    button.setAttribute('aria-pressed', String(selected?.name === note.name));
    const heading = document.createElement('strong'); heading.textContent = title(note.content);
    const preview = document.createElement('small'); preview.textContent = note.content.replace(/\s+/g, ' ').trim().slice(0, 75) || 'Empty note';
    button.append(heading, preview);
    button.addEventListener('click', () => {
      if (!confirmDiscard()) return;
      selected = {name: note.name, revision: note.revision ?? 0};
      text.value = note.content; baseline = note.content;
      feedback.textContent = 'Note opened.'; updateEditor(); renderList();
    });
    list.append(button);
  }
}
async function refresh() {
  if (!db) return;
  const records = await listFiles(db);
  notes = records.filter(f => notePattern.test(f.name) && typeof f.content === 'string').sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  renderList();
}
function busy(value) { pending = value; updateEditor(); }
const ready = openWorkspace().then(async result => {
  db = result;
  db.onversionchange = () => { db.close(); db = null; feedback.textContent = 'Local storage closed for upgrade. Reload this page.'; updateEditor(); };
  await refresh(); updateEditor();
}).catch(e => { feedback.textContent = 'Notes unavailable: ' + e.message; updateEditor(); });
text.addEventListener('input', updateEditor);
$('note-search').addEventListener('input', renderList);
$('note-new').addEventListener('click', () => {
  if (!confirmDiscard()) return;
  selected = null; text.value = ''; baseline = ''; feedback.textContent = 'New note ready.';
  updateEditor(); renderList(); text.focus();
});
$('note-save').addEventListener('click', async () => {
  await ready; if (!db || pending) return;
  if (!text.value.trim()) { feedback.textContent = 'Write something before saving a note.'; return; }
  if (new TextEncoder().encode(text.value).byteLength > 1024 * 1024) { feedback.textContent = 'Notes are limited to 1 MiB.'; return; }
  busy(true);
  try {
    const content = text.value, name = selected?.name || makeName();
    const record = await saveFile(db, name, content, selected?.revision ?? null);
    selected = {name, revision: record.revision}; baseline = content;
    feedback.textContent = 'Note saved locally. Export backups for important work.';
    await refresh(); window.dispatchEvent(new Event('workspace:refresh'));
  } catch(e) { feedback.textContent = 'Save failed: ' + e.message; }
  finally { busy(false); }
});
$('note-delete').addEventListener('click', async () => {
  if (!db || !selected || pending) return;
  if (!confirm('Delete this saved note? Unsaved changes to it will also be lost.')) return;
  busy(true);
  try {
    await deleteFile(db, selected.name, selected.revision);
    selected = null; text.value = ''; baseline = ''; feedback.textContent = 'Note deleted.';
    await refresh(); window.dispatchEvent(new Event('workspace:refresh'));
  } catch(e) { feedback.textContent = 'Delete failed: ' + e.message; await refresh().catch(() => {}); }
  finally { busy(false); }
});
window.addEventListener('workspace:refresh', () => { ready.then(refresh).catch(e => { feedback.textContent = 'Notes refresh failed: ' + e.message; }); });
window.addEventListener('focus', () => { ready.then(refresh).catch(() => {}); });
window.addEventListener('beforeunload', event => { if (dirty()) { event.preventDefault(); event.returnValue = ''; } });
updateEditor();
