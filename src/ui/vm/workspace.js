// Browser-owned workspace. Guest transfers are explicit snapshots, not live sync.
const DB = 'linuxhtml-workspace';
const STORE = 'files';
export function openWorkspace() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'name' });
    request.onerror = () => reject(request.error || new Error('Cannot open local workspace'));
    request.onblocked = () => reject(new Error('Workspace database upgrade blocked by another tab'));
    request.onsuccess = () => resolve(request.result);
  });
}
function transaction(db, mode, action) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    let request;
    try { request = action(tx.objectStore(STORE)); }
    catch (e) { tx.abort(); reject(e); return; }
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = () => reject(tx.error || new Error('Workspace transaction aborted'));
    tx.onerror = () => {}; // onabort reports the transaction failure
  });
}
export const listFiles = db => transaction(db, 'readonly', store => store.getAll());
// Compare and write inside one transaction, preventing silent overwrites across tabs.
// expectedRevision is null for a new file; old records without a revision are 0.
export function saveFile(db, name, content, expectedRevision = null) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const get = store.get(name);
    let written, conflict = false;
    get.onsuccess = () => {
      const current = get.result;
      const actualRevision = current ? (current.revision ?? 0) : null;
      if (actualRevision !== expectedRevision) { conflict = true; tx.abort(); return; }
      const revision = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
      written = {name, content, updatedAt: Date.now(), revision};
      store.put(written);
    };
    tx.oncomplete = () => resolve(written);
    tx.onabort = () => reject(conflict
      ? new Error('File changed or already exists. Open the latest local version before saving.')
      : tx.error || new Error('Workspace transaction aborted'));
    tx.onerror = () => {};
  });
}
export function deleteFile(db, name, expectedRevision) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    let conflict = false;
    const get = store.get(name);
    get.onsuccess = () => {
      const current = get.result;
      if (!current || (current.revision ?? 0) !== expectedRevision) { conflict = true; tx.abort(); return; }
      store.delete(name);
    };
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(conflict ? new Error('File changed or no longer exists. Refresh the list before deleting.') : tx.error || new Error('Workspace transaction aborted'));
    tx.onerror = () => {};
  });
}

// Import-only transaction. add(), rather than put(), aborts the entire batch if
// any filename already exists, including writes racing from another tab.
export function restoreNewFiles(db, files) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const file of files) {
      const revision = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
      store.add({name: file.name, content: file.content, updatedAt: Date.now(), revision});
    }
    tx.oncomplete = () => resolve(files.length);
    tx.onabort = () => reject(tx.error?.name === 'ConstraintError'
      ? new Error('A filename already exists. Nothing was imported; rename or remove the conflicting local file first.')
      : tx.error || new Error('Restore failed; no files were imported'));
    tx.onerror = () => {};
  });
}

// Copy or rename is one transaction: source revision is checked and add never
// overwrites the destination. A failed operation leaves both names unchanged.
export function copyOrRenameFile(db, oldName, newName, expectedRevision, rename = false) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    let conflict = false, written;
    const get = store.get(oldName);
    get.onsuccess = () => {
      const source = get.result;
      if (!source || (source.revision ?? 0) !== expectedRevision) { conflict = true; tx.abort(); return; }
      const revision = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
      written = {name:newName, content:source.content, updatedAt:Date.now(), revision};
      const add = store.add(written);
      if (rename) add.onsuccess = () => store.delete(oldName);
    };
    tx.oncomplete = () => resolve(written);
    tx.onabort = () => reject(conflict ? new Error('The selected file changed or no longer exists. Refresh and try again.')
      : tx.error?.name === 'ConstraintError' ? new Error('Destination already exists. No files were changed.')
      : tx.error || new Error('File operation failed; no changes were saved.'));
    tx.onerror = () => {};
  });
}
