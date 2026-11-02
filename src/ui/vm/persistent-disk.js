// Experimental browser-backed sparse IDE disk for the Alpine live guest.
// IndexedDB writes are acknowledged to v86 only after transaction completion.
const DB = 'linuxhtml-alpine-disk-v1', META = 'meta', BLOCKS = 'blocks';
const SIZE = 256 * 1024 * 1024, BLOCK = 64 * 1024, FORMAT = 'ext2-256m-v1';
const range = generation => IDBKeyRange.bound([generation, 0], [generation, SIZE / BLOCK - 1]);
const txn = (db, stores, mode, action) => new Promise((resolve,reject) => {
  let tx;
  try { tx = db.transaction(stores,mode,mode === 'readwrite' ? {durability:'strict'} : undefined); }
  catch(e) { reject(e); return; }
  let result;
  try { result = action(tx); } catch(e) { tx.abort(); reject(e); return; }
  tx.oncomplete = () => resolve(typeof result === 'function' ? result() : result);
  tx.onabort = () => reject(tx.error || new Error('Disk transaction aborted'));
  tx.onerror = () => {};
});
function openDB() { return new Promise((resolve,reject) => {
  const request=indexedDB.open(DB,1);
  request.onupgradeneeded=()=>{request.result.createObjectStore(META);request.result.createObjectStore(BLOCKS);};
  request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error || new Error('Disk storage unavailable'));
  request.onblocked=()=>reject(new Error('Disk storage is blocked by another tab'));
}); }
async function exclusiveLock() {
  if (!navigator.locks?.request) throw new Error('Persistent disk needs Web Locks support to prevent concurrent writes.');
  let release, resolveAcquired, rejectAcquired;
  const held = new Promise(r => {release=r;});
  const acquired = new Promise((r,j) => {resolveAcquired=r;rejectAcquired=j;});
  navigator.locks.request(DB,{mode:'exclusive',ifAvailable:true},async lock=>{
    if(!lock) {rejectAcquired(new Error('Persistent disk is in use by another tab. Close that VM and retry.'));return;}
    resolveAcquired(); await held;
  }).catch(rejectAcquired);
  await acquired; return release;
}
const newGeneration = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b=>b.toString(16).padStart(2,'0')).join('');
const isNonzero = bytes => bytes.some(value=>value !== 0);
async function clearGeneration(db,generation) { await txn(db,[BLOCKS],'readwrite',tx=>{tx.objectStore(BLOCKS).delete(range(generation));}); }
async function cleanupOrphans(db, activeGeneration) {
  const generations=await txn(db,[BLOCKS],'readonly',tx=>{
    const found=new Set(), request=tx.objectStore(BLOCKS).openKeyCursor();
    request.onsuccess=()=>{const cursor=request.result;if(cursor){if(Array.isArray(cursor.key) && typeof cursor.key[0]==='string')found.add(cursor.key[0]);cursor.continue();}};
    return ()=>[...found];
  });
  for(const generation of generations) if(generation!==activeGeneration) await clearGeneration(db,generation);
}
async function metaGet(db,key) { return txn(db,[META],'readonly',tx=>{const r=tx.objectStore(META).get(key);return ()=>r.result;}); }
async function metaPut(db,key,value) { return txn(db,[META],'readwrite',tx=>{tx.objectStore(META).put(value,key);}); }
async function writeBatch(db,generation,batch) {
  if(!batch.length) return;
  await txn(db,[BLOCKS],'readwrite',tx=>{const store=tx.objectStore(BLOCKS); for(const [i,bytes] of batch) store.put(bytes,[generation,i]);});
}
// Builds a new generation without touching the current generation. A final metadata
// update switches generations atomically; interrupted imports leave old data intact.
async function stageImage(db, stream, expectedFormat = true) {
  const generation=newGeneration(); await metaPut(db,'staging',generation);
  let reader=stream.getReader(), partial=new Uint8Array(BLOCK), used=0, index=0, total=0, batch=[], superblock=null;
  try {
    while(true) {
      const {value,done}=await reader.read(); if(done) break;
      let offset=0; total += value.byteLength;
      if(total > SIZE) throw new Error('Disk image exceeds 256 MiB');
      while(offset<value.length) {
        const n=Math.min(BLOCK-used,value.length-offset); partial.set(value.subarray(offset,offset+n),used);used+=n;offset+=n;
        if(used===BLOCK) {
          if(index===0) superblock=partial.slice(1024,2048);
          if(isNonzero(partial)) batch.push([index,partial]);
          partial=new Uint8Array(BLOCK); used=0; index++;
          if(batch.length>=16) { await writeBatch(db,generation,batch); batch=[]; }
        }
      }
    }
    if(total!==SIZE || used!==0 || index!==SIZE/BLOCK) throw new Error('Disk image must expand to exactly 256 MiB');
    if(expectedFormat) {
      if (!superblock || superblock[56]!==0x53 || superblock[57]!==0xef) throw new Error('Disk image is not an ext2 filesystem');
      const view=new DataView(superblock.buffer,superblock.byteOffset,superblock.byteLength);
      if (view.getUint32(4,true)!==262144 || view.getUint32(24,true)!==0) throw new Error('Disk image does not match the required ext2 geometry');
    }
    await writeBatch(db,generation,batch);
    const old=await metaGet(db,'active');
    await txn(db,[META],'readwrite',tx=>{const store=tx.objectStore(META);store.put({generation,format:FORMAT,size:SIZE},'active');store.delete('staging');});
    // The active swap is already committed. Orphaned old blocks are harmless if cleanup fails.
    if(old?.generation) { try { await clearGeneration(db,old.generation); } catch(e) { console.warn('Old disk blocks could not be cleared',e); } }
    return generation;
  } catch(e) {
    try { await clearGeneration(db,generation); await txn(db,[META],'readwrite',tx=>tx.objectStore(META).delete('staging')); } catch {}
    throw e;
  } finally { reader.releaseLock(); }
}
export async function openPersistentDisk(seedBytes, onFault) {
  const release=await exclusiveLock(); let db;
  try {
    db=await openDB(); db.onversionchange=()=>{db.close();onFault(new Error('Disk database was closed for upgrade'));};
    const stale=await metaGet(db,'staging'); if(stale) { await clearGeneration(db,stale); await txn(db,[META],'readwrite',tx=>tx.objectStore(META).delete('staging')); }
    let active=await metaGet(db,'active');
    if(!active) {
      if(typeof DecompressionStream!=='function') throw new Error('Disk initialization needs gzip decompression support.');
      const generation=await stageImage(db,new Blob([seedBytes]).stream().pipeThrough(new DecompressionStream('gzip')));
      active={generation,format:FORMAT,size:SIZE};
    }
    if(active.format!==FORMAT || active.size!==SIZE || typeof active.generation!=='string') throw new Error('Persistent disk format is incompatible.');
    await cleanupOrphans(db,active.generation);
    const disk=new IndexedDisk(db,active.generation,onFault,release);
    disk.mbr=await disk.read(0,512);
    return disk;
  } catch(e) { db?.close();release();throw e; }
}
class IndexedDisk {
  constructor(db,generation,onFault,release) {this.db=db;this.generation=generation;this.onFault=onFault;this.release=release;this.byteLength=SIZE;this.pending=0;this.waiters=[];this.failed=false;this.mbr=null;}
  load() { queueMicrotask(()=>this.onload?.({})); }
  check(start,len) {if(!Number.isSafeInteger(start)||!Number.isSafeInteger(len)||start<0||len<0||start+len>SIZE) throw new Error('Disk I/O out of bounds');}
  fail(e) {if(!this.failed){this.failed=true;this.onFault(e);}}
  track(promise,callback) {
    this.pending++;
    promise.then(async value=>{await callback(value);},error=>this.fail(error))
      .catch(error=>this.fail(error))
      .finally(()=>{this.pending--;if(!this.pending){for(const resolve of this.waiters.splice(0))resolve();}});
  }
  idle() {return this.pending ? new Promise(resolve=>this.waiters.push(resolve)) : Promise.resolve();}
  async read(start,len) {
    this.check(start,len); const first=Math.floor(start/BLOCK),last=Math.floor((start+len-1)/BLOCK), result=new Uint8Array(len), gen=this.generation;
    if(!len) return result;
    return txn(this.db,[BLOCKS],'readonly',tx=>{
      const store=tx.objectStore(BLOCKS), requests=[];
      for(let i=first;i<=last;i++) requests.push([i,store.get([gen,i])]);
      return ()=>{for(const [i,request] of requests){const bytes=request.result;if(bytes){const lo=Math.max(start,i*BLOCK),hi=Math.min(start+len,(i+1)*BLOCK);result.set(bytes.subarray(lo-i*BLOCK,hi-i*BLOCK),lo-start);}}return result;};
    });
  }
  get(start,len,callback) {if(this.failed)return;this.track(this.read(start,len),callback);}
  get_and_cache(start,len,callback) {this.get(start,len,data=>{if(start===0 && len>=512)this.mbr=data.slice(0,512);callback(data);});}
  get_from_cache(start,len) {return start===0 && len===512 ? this.mbr : undefined;}
  set(start,data,callback) {
    if(this.failed)return;
    let input;try {this.check(start,data.byteLength);input=data.slice();}catch(e){this.fail(e);return;}
    if(!input.length){callback();return;}
    const first=Math.floor(start/BLOCK),last=Math.floor((start+input.length-1)/BLOCK),gen=this.generation;
    const operation=txn(this.db,[BLOCKS],'readwrite',tx=>{
      const store=tx.objectStore(BLOCKS);
      for(let i=first;i<=last;i++) {
        const req=store.get([gen,i]);req.onsuccess=()=>{
          const block=req.result || new Uint8Array(BLOCK),lo=Math.max(start,i*BLOCK),hi=Math.min(start+input.length,(i+1)*BLOCK);
          block.set(input.subarray(lo-start,hi-start),lo-i*BLOCK);store.put(block,[gen,i]);
        };
      }
    });
    this.track(operation,async()=>{if(start<512){this.mbr=null;this.mbr=await this.read(0,512);}callback();});
  }
  async importImage(file) {
    if (this.failed) throw new Error('Disk is in a failed state.');
    if (file.size > SIZE + 1024 * 1024) throw new Error('Backup file is too large.');
    const signature=new Uint8Array(await file.slice(0,2).arrayBuffer());
    let stream=file.stream();
    if(signature[0]===0x1f && signature[1]===0x8b) {
      if(typeof DecompressionStream!=='function') throw new Error('This browser cannot decompress gzip backups.');
      stream=stream.pipeThrough(new DecompressionStream('gzip'));
    }
    const generation=await stageImage(this.db,stream);
    this.generation=generation;
  }
  exportStream() {
    if(this.failed) throw new Error('Disk is in a failed state.');
    let offset=0; const disk=this;
    return new ReadableStream({async pull(controller) {
      if(offset>=SIZE){controller.close();return;}
      try {const bytes=await disk.read(offset,BLOCK);offset+=BLOCK;controller.enqueue(bytes);} catch(e){controller.error(e);}
    }});
  }
  close(){this.db.close();this.release();}
  // The Alpine snapshot feature is deliberately disabled; this disk is stored separately.
}
