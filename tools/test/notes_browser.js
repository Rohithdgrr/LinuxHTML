// With build/pwa served on :8765 and an open arena Playwright session:
// playwright-cli -s=arena run-code "$(cat tools/test/notes_browser.js)"
async page => {
  const ctx = await page.context().browser().newContext({serviceWorkers:'block',acceptDownloads:true,viewport:{width:1280,height:800}});
  const a = await ctx.newPage(); const errors=[]; a.on('pageerror',e=>errors.push(e.message));
  const check=(v,m)=>{if(!v)throw new Error(m)};
  try {
    await a.goto('http://127.0.0.1:8765/'); await a.getByRole('button',{name:'Open Notes'}).click();
    await a.locator('#note-text').fill('Meeting ideas\nBuild something useful.'); await a.locator('#note-save').click();
    await a.waitForFunction(()=>document.querySelector('#note-status').textContent.startsWith('Note saved'));
    await a.waitForFunction(()=>document.querySelector('#note-count').textContent==='1');
    await a.locator('#note-new').click(); await a.locator('#note-text').fill('Shopping list\nMilk and tea'); await a.locator('#note-save').click();
    await a.waitForFunction(()=>document.querySelector('#note-count').textContent==='2');
    await a.locator('#note-search').fill('meeting');
    check(await a.locator('.note-item').count()===1,'Search did not filter notes');
    await a.locator('#note-search').fill('');
    await a.locator('#note-text').fill('Unsaved draft');
    a.once('dialog',d=>d.dismiss()); await a.locator('.note-item').filter({hasText:'Meeting ideas'}).click();
    check(await a.locator('#note-text').inputValue()==='Unsaved draft','Cancelled switch lost draft');
    a.once('dialog',d=>d.accept()); await a.locator('.note-item').filter({hasText:'Meeting ideas'}).click();
    check((await a.locator('#note-text').inputValue()).includes('Build something useful'),'Open failed');
    const b=await ctx.newPage(); b.on('pageerror',e=>errors.push(e.message));
    await b.goto('http://127.0.0.1:8765/'); await b.getByRole('button',{name:'Open Notes'}).click();
    await b.waitForFunction(()=>document.querySelector('#note-count').textContent==='2');
    await b.locator('.note-item').filter({hasText:'Meeting ideas'}).click();
    await a.locator('#note-text').fill('Meeting ideas\nNewer content'); await a.locator('#note-save').click();
    await a.waitForFunction(()=>document.querySelector('#note-status').textContent.startsWith('Note saved'));
    await b.locator('#note-text').fill('Meeting ideas\nStale content'); await b.locator('#note-save').click();
    await b.waitForFunction(()=>document.querySelector('#note-status').textContent.startsWith('Save failed'));
    check((await b.locator('#note-status').innerText()).includes('changed'),'Stale write was not rejected');
    b.once('dialog',d=>d.accept()); await b.locator('#note-delete').click();
    await b.waitForFunction(()=>document.querySelector('#note-status').textContent.startsWith('Delete failed'));
    await a.getByRole('button',{name:'Back up notes →'}).click();
    await a.evaluate(()=>{const original=URL.createObjectURL;URL.createObjectURL=function(blob){window.testBackup=blob;return original.call(this,blob)}});
    const download=a.waitForEvent('download'); await a.locator('#backup-export').click(); await download;
    const backup=await a.evaluate(async()=>JSON.parse(await window.testBackup.text()));
    check(backup.files.length===2 && backup.files.some(f=>f.content.includes('Newer content')),'Notes missing from backup');
    await a.reload(); await a.getByRole('button',{name:'Open Notes'}).click();
    await a.waitForFunction(()=>document.querySelector('#note-count').textContent==='2');
    await a.locator('.note-item').filter({hasText:'Meeting ideas'}).click();
    check((await a.locator('#note-text').inputValue()).includes('Newer content'),'Reload lost note');
    a.once('dialog',d=>d.accept()); await a.locator('#note-delete').click();
    await a.waitForFunction(()=>document.querySelector('#note-count').textContent==='1');
    await a.getByRole('button',{name:'Back up notes →'}).click();
    const deleted = backup.files.find(file => file.content.includes('Newer content'));
    a.once('dialog',d=>d.accept());
    await a.locator('#backup-import').setInputFiles({name:'notes.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'linuxhtml-workspace',version:1,files:[deleted]}))});
    await a.waitForFunction(()=>document.querySelector('#backup-status').textContent.startsWith('Restored'));
    await a.getByRole('button',{name:'Open Notes'}).click();
    await a.waitForFunction(()=>document.querySelector('#note-count').textContent==='2');
    check(errors.length===0,'Page errors: '+errors.join(', '));
    return 'PASS: create, search, discard warning, concurrent conflict, backup, reload, delete and restore';
  } finally { await ctx.close(); }
}
