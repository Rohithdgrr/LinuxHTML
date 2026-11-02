// Run with a built PWA served on :8765 and an open arena Playwright session:
// playwright-cli -s=arena run-code "$(cat tools/test/backup_browser.js)"
async page => {
  const ctx = await page.context().browser().newContext({serviceWorkers:'block', acceptDownloads:true});
  const p = await ctx.newPage();
  const errors=[]; p.on('pageerror', e => errors.push(e.message));
  const check=(condition,message)=>{if(!condition) throw new Error(message)};
  try {
    await p.goto('http://127.0.0.1:8765/');
    await p.getByRole('button',{name:'Open Files and editor'}).click();
    await p.locator('#filename').fill('original.txt'); await p.locator('#filecontent').fill('secret example');
    await p.locator('#save-local').click(); await p.waitForFunction(()=>document.querySelector('#file-status').textContent.startsWith('Saved'));
    await p.getByRole('button',{name:'Open Settings'}).click();
    await p.getByRole('button',{name:'Open backups →'}).click();
    await p.evaluate(()=>{const old=URL.createObjectURL;URL.createObjectURL=function(blob){window.testBackup=blob;return old.call(this,blob)}});
    const downloadPromise=p.waitForEvent('download'); await p.locator('#backup-export').click(); const download=await downloadPromise;
    const exported=await p.evaluate(async()=>JSON.parse(await window.testBackup.text()));
    check(download.suggestedFilename()==='linuxhtml-workspace-backup.json','Wrong backup name');
    check(exported.version===1 && exported.files.length===1 && exported.files[0].content==='secret example','Backup missing content');
    const payload = files => ({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'linuxhtml-workspace',version:1,files}))});
    p.once('dialog', d=>d.accept());
    await p.locator('#backup-import').setInputFiles(payload([{name:'fresh.txt',content:'new'},{name:'original.txt',content:'bad overwrite'}]));
    await p.waitForFunction(()=>document.querySelector('#backup-status').textContent.includes('Restore failed'));
    let files=await p.evaluate(async()=>{const m=await import('./workspace.js');const db=await m.openWorkspace();const a=await m.listFiles(db);db.close();return a});
    check(files.length===1 && files[0].content==='secret example','Conflict did not roll back entire restore');
    await p.locator('#backup-import').setInputFiles(payload([{name:'dup.txt',content:'one'},{name:'dup.txt',content:'two'}]));
    await p.waitForFunction(()=>document.querySelector('#backup-status').textContent.includes('Duplicate'));
    await p.locator('#backup-import').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{broken')});
    await p.waitForFunction(()=>document.querySelector('#backup-status').textContent.includes('valid UTF-8 JSON'));
    p.once('dialog', d=>d.accept());
    await p.locator('#backup-import').setInputFiles(payload([{name:'fresh.txt',content:'restored'}]));
    await p.waitForFunction(()=>document.querySelector('#backup-status').textContent.startsWith('Restored'));
    await p.getByRole('button',{name:'Open Files and editor'}).click();
    await p.waitForFunction(()=>[...document.querySelector('#file-list').options].some(o=>o.value==='fresh.txt'));
    await p.locator('#file-list').selectOption('fresh.txt'); await p.locator('#load-local').click();
    await p.waitForFunction(()=>document.querySelector('#file-status').textContent.startsWith('Opened'));
    check(await p.locator('#filecontent').inputValue()==='restored','Restored file did not load');
    check(errors.length===0,'Page errors: '+errors.join(', '));
    return 'PASS: export, atomic conflict rollback, invalid backup rejection and successful restore';
  } finally { await ctx.close(); }
}
