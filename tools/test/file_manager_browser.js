// With PWA served on :8765 and an open arena Playwright session:
// playwright-cli -s=arena run-code "$(cat tools/test/file_manager_browser.js)"
async page => {
  const ctx=await page.context().browser().newContext({serviceWorkers:'block',viewport:{width:1280,height:800}});
  const p=await ctx.newPage(); const errors=[];p.on('pageerror',e=>errors.push(e.message));
  const check=(v,m)=>{if(!v)throw new Error(m)};
  try {
    await p.goto('http://127.0.0.1:8765/');await p.getByRole('button',{name:'Open Files and editor'}).click();
    await p.locator('#filename').fill('alpha.txt');await p.locator('#filecontent').fill('saved version');await p.locator('#save-local').click();
    await p.waitForFunction(()=>document.querySelector('#file-status').textContent.startsWith('Saved'));
    await p.locator('#filecontent').fill('unsaved version');
    await p.locator('#file-target-name').fill('beta.txt');await p.locator('#copy-local').click();
    await p.waitForFunction(()=>document.querySelector('#file-status').textContent.startsWith('Duplicated'));
    await p.locator('#file-search').fill('beta');check((await p.locator('#file-count').innerText())==='1 / 2','Search count incorrect');
    await p.locator('#file-search').fill('');await p.locator('#file-list').selectOption('beta.txt');
    await p.locator('#file-target-name').fill('alpha.txt');await p.locator('#rename-local').click();
    await p.waitForFunction(()=>document.querySelector('#file-status').textContent.startsWith('Rename failed'));
    check((await p.locator('#file-status').innerText()).includes('already exists'),'Destination conflict not reported');
    await p.locator('#file-target-name').fill('gamma.txt');await p.locator('#rename-local').click();
    await p.waitForFunction(()=>document.querySelector('#file-status').textContent.startsWith('Renamed'));
    p.once('dialog',d=>d.accept());await p.locator('#load-local').click();
    await p.waitForFunction(()=>document.querySelector('#file-status').textContent.startsWith('Opened'));
    check(await p.locator('#filecontent').inputValue()==='saved version','Duplicate included unsaved editor changes');
    await p.locator('#filecontent').fill('unsaved gamma edit');await p.locator('#file-target-name').fill('delta.txt');await p.locator('#rename-local').click();
    await p.waitForFunction(()=>document.querySelector('#file-status').textContent.startsWith('Renamed'));
    check(await p.locator('#filename').inputValue()==='delta.txt','Open file was not retargeted');
    check(await p.locator('#filecontent').inputValue()==='unsaved gamma edit','Rename discarded edits');
    await p.locator('#save-local').click();await p.waitForFunction(()=>document.querySelector('#file-status').textContent.startsWith('Saved'));
    const b=await ctx.newPage(); await b.goto('http://127.0.0.1:8765/'); await b.getByRole('button',{name:'Open Files and editor'}).click();
    await b.waitForFunction(()=>[...document.querySelector('#file-list').options].some(o=>o.value==='delta.txt'));
    await b.locator('#file-list').selectOption('delta.txt');
    await p.locator('#filecontent').fill('newer edit');await p.locator('#save-local').click();await p.waitForFunction(()=>document.querySelector('#file-status').textContent.startsWith('Saved'));
    await b.locator('#file-target-name').fill('stale.txt');await b.locator('#rename-local').click();
    await b.waitForFunction(()=>document.querySelector('#file-status').textContent.startsWith('Rename failed'));
    check((await b.locator('#file-status').innerText()).includes('changed'),'Stale rename was not rejected');
    const files=await p.evaluate(async()=>{const m=await import('./workspace.js');const db=await m.openWorkspace();const files=await m.listFiles(db);db.close();return files});
    check(files.length===2 && files.some(f=>f.name==='delta.txt' && f.content==='newer edit') && files.some(f=>f.name==='alpha.txt'),'Files changed incorrectly');
    check(errors.length===0,'Page errors: '+errors.join(', '));
    return 'PASS: search, duplicate, rename, conflicts, unsaved edits and atomicity';
  } finally {await ctx.close();}
}
