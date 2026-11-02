// With build/pwa-alpine served on :8767, run via playwright-cli.
async page => {
 const c=await page.context().browser().newContext({serviceWorkers:'block'}),p=await c.newPage();
 try {
  await p.goto('http://127.0.0.1:8767/');
  const output=await p.evaluate(async()=>{
   const {openPersistentDisk}=await import('./persistent-disk.js');
   const seed=await (await fetch('./assets/alpine-data-ext2.img.gz')).arrayBuffer();const faults=[];
   let disk=await openPersistentDisk(seed,e=>faults.push(e.message));
   const write=(pos,value)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('write timeout')),10000);disk.set(pos,new Uint8Array(value),()=>{clearTimeout(timer);resolve();});});
   const pos=256*1024*1024-65536;
   await write(pos,[1,2,3,4]);if((await disk.read(pos,4)).join(',')!=='1,2,3,4')throw Error('write failed');
   await Promise.all([write(pos+10,[1,2,3,4]),write(pos+12,[8,9])]);
   if((await disk.read(pos+10,4)).join(',')!=='1,2,8,9')throw Error('overlapping writes lost updates');
   const zipped=await new Response(disk.exportStream().pipeThrough(new CompressionStream('gzip'))).blob();
   await write(pos,[9,8,7,6]);
   try{await disk.importImage(new File([new Uint8Array([1,2,3])],'bad.img'));throw Error('bad backup accepted');}catch(e){if(e.message==='bad backup accepted')throw e;}
   if((await disk.read(pos,4)).join(',')!=='9,8,7,6')throw Error('failed import destroyed data');
   await disk.importImage(new File([zipped],'backup.img.gz'));
   if((await disk.read(pos,4)).join(',')!=='1,2,3,4')throw Error('restore mismatch');
   let blocked=false;try{await openPersistentDisk(seed,()=>{});}catch(e){blocked=e.message.includes('another tab');}if(!blocked)throw Error('concurrent disk lock failed');
   disk.close();await new Promise(r=>setTimeout(r,50));
   disk=await openPersistentDisk(seed,e=>faults.push(e.message));if((await disk.read(pos,4)).join(',')!=='1,2,3,4')throw Error('reopen lost data');
   let callback=false;disk.db.close();disk.set(pos,new Uint8Array([9]),()=>{callback=true});await new Promise(r=>setTimeout(r,100));
   if(!disk.failed || callback || faults.length!==1)throw Error('failed write was acknowledged');disk.close();
   return {backupMiB:(zipped.size/1048576).toFixed(2),atomicImport:true,exclusiveLock:true,failedWriteNotAcknowledged:true};
  });return output;
 } finally {await c.close();}
}
