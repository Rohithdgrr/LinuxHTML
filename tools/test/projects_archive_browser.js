// With backend/dev_server.py on :8766 and the test-only token, run via playwright-cli.
async page => {
 const c=await page.context().browser().newContext({serviceWorkers:'block',acceptDownloads:true,viewport:{width:1280,height:900}}),p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 const assert=(v,m)=>{if(!v)throw Error(m)};
 try {
  await p.goto('http://127.0.0.1:8766/');await p.getByRole('button',{name:'Open app launcher'}).click();await p.getByRole('button',{name:'Server projects Manual self-hosted files'}).click();
  await p.locator('#project-token').fill('development-token-for-tests-only-123456789');await p.locator('#project-connect').click();await p.locator('#project-status').getByText('Connected.',{exact:false}).waitFor();
  const a='zipa'+Date.now(), b='zipb'+Date.now();await p.locator('#project-new-name').fill(a);await p.locator('#project-create').click();await p.locator('#project-status').getByText('Created project '+a,{exact:false}).waitFor();
  await p.locator('#project-path').fill('assets/sample.bin');await p.locator('#project-upload-file').setInputFiles({name:'sample.bin',mimeType:'application/octet-stream',buffer:Buffer.from([0,255,1,2,3])});await p.locator('#project-upload').click();await p.locator('#project-status').getByText('Uploaded new binary file',{exact:false}).waitFor();
  await p.locator('#project-upload-file').setInputFiles({name:'sample.bin',mimeType:'application/octet-stream',buffer:Buffer.from([1])});await p.locator('#project-upload').click();await p.locator('#project-status').getByText('Revision conflict',{exact:false}).waitFor();
  await p.locator('#project-files').selectOption('assets/sample.bin'); p.once('dialog',d=>d.accept()); await p.locator('#project-open').click(); await p.locator('#project-status').getByText('Opened binary file',{exact:false}).waitFor();assert(await p.locator('#project-text').getAttribute('readonly') !== null,'Binary editable');
  const [bin]=await Promise.all([p.waitForEvent('download'),p.locator('#project-download').click()]);const path=await bin.path();assert(path,'Binary download missing');
  await p.locator('#project-path').fill('assets/moved.bin');await p.locator('#project-move').click();await p.locator('#project-status').getByText('Moved saved server file',{exact:false}).waitFor();
  const [zip]=await Promise.all([p.waitForEvent('download'),p.locator('#project-export-archive').click()]);const zipPath=await zip.path();assert(zipPath,'ZIP missing');
  await p.locator('#project-new-name').fill(b);await p.locator('#project-create').click();await p.locator('#project-status').getByText('Created project '+b,{exact:false}).waitFor();
  await p.locator('#project-archive-file').setInputFiles(zipPath);p.once('dialog',d=>d.accept());await p.locator('#project-import-archive').click();await p.locator('#project-status').getByText('Imported 1 files',{exact:false}).waitFor();
  await p.locator('#project-files').selectOption('assets/moved.bin');const [bin2]=await Promise.all([p.waitForEvent('download'),p.locator('#project-download').click()]);assert(await bin2.path(),'ZIP import download missing');
  await p.locator('#project-archive-file').setInputFiles(zipPath);p.once('dialog',d=>d.accept());await p.locator('#project-import-archive').click();await p.locator('#project-status').getByText('nothing imported',{exact:false}).waitFor();
  await p.screenshot({path:'/home/user/linuxhtml-project-archives.png'});assert(errors.length===0,errors.join('; '));return 'PASS binary upload/download, ZIP export/import, conflict rollback';
 }finally{await c.close();}
}
