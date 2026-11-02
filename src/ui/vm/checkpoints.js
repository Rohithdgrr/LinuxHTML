// Explicit VM checkpoint, not a filesystem backup. One atomic slot per guest.
const DB = 'linuxhtml-vm-checkpoints', STORE = 'snapshots', CHUNKS = 'chunks';
const CHUNK_BYTES = 8 * 1024 * 1024;
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 2);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, {keyPath:'guest'});
      if (!req.result.objectStoreNames.contains(CHUNKS)) req.result.createObjectStore(CHUNKS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Checkpoint storage unavailable'));
    req.onblocked = () => reject(new Error('Checkpoint storage blocked by another tab'));
  });
}
const range = guest => IDBKeyRange.bound(guest + '#', guest + '#\uffff');
async function transaction(mode, action) {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE,CHUNKS],mode); let result;
      try { result = action(tx.objectStore(STORE), tx.objectStore(CHUNKS)); } catch(e) { tx.abort(); reject(e); return; }
      tx.oncomplete = () => resolve(result());
      tx.onabort = () => reject(tx.error || new Error('Checkpoint transaction aborted (storage quota or access failure)'));
      tx.onerror = () => {};
    });
  } finally { db.close(); }
}
export async function getCheckpoint(guest) {
  const {meta,chunks} = await transaction('readonly',(store, parts) => {
    const meta = store.get(guest), chunks = parts.getAll(range(guest));
    return () => ({meta:meta.result, chunks:chunks.result});
  });
  if (!meta || !meta.chunkCount) return meta;
  if (chunks.length !== meta.chunkCount || chunks.some(c => !(c instanceof Blob))) throw new Error('Checkpoint chunks are missing or invalid.');
  const state = new Blob(chunks);
  if (state.size !== meta.byteLength) throw new Error('Checkpoint length is invalid.');
  return {...meta,state};
}
export function putCheckpoint(checkpoint) {
  if (!(checkpoint.state instanceof Blob) || checkpoint.state.size === 0) throw new Error('Empty checkpoint');
  const state = checkpoint.state, count = Math.ceil(state.size / CHUNK_BYTES);
  return transaction('readwrite',(store, parts) => {
    parts.delete(range(checkpoint.guest));
    for (let i=0; i<count; i++) parts.put(state.slice(i*CHUNK_BYTES,(i+1)*CHUNK_BYTES), checkpoint.guest + '#' + String(i).padStart(6,'0'));
    store.put({guest:checkpoint.guest,fingerprint:checkpoint.fingerprint,savedAt:checkpoint.savedAt,encoding:checkpoint.encoding,byteLength:state.size,chunkCount:count});
    return () => undefined;
  });
}
export const deleteCheckpoint = guest => transaction('readwrite',(store,parts) => {
  store.delete(guest); parts.delete(range(guest)); return () => undefined;
});
