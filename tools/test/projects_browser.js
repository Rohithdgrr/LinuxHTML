// Serve via backend/dev_server.py on 8766 using the token below, then run with playwright-cli.
async page => {
 const ctx=await page.context().browser().newContext({serviceWorkers:'block',viewport:{width:1280,height:900}}), p=await ctx.newPage();
 const errors=[]; p.on('pageerror',e=>errors.push(e.message));
 const check=(b,m)=>{if(!b)throw new Error(m)}; const token='development-token-for-tests-only-123456789';
 try {
  await p.goto('http://127.0.0.1:8766/'); await p.getByRole('button',{name:'Open app launcher'}).click(); await p.getByRole('button',{name:'Server projects Manual self-hosted files'}).click();
  await p.locator('#project-token').fill('invalid-token'); await p.locator('#project-connect').click(); await p.locator('#project-status').getByText('Unauthorized').waitFor();
  await p.locator('#project-token').fill(token); await p.locator('#project-connect').click(); await p.locator('#project-status').getByText('Connected.',{exact:false}).waitFor();
  check(await p.locator('#project-token').inputValue()==='', 'token input was not cleared');
  await p.locator('#project-health').click(); await p.locator('#project-status').getByText('Server storage:',{exact:false}).waitFor();
  const name='test'+Date.now(); await p.locator('#project-new-name').fill(name); await p.locator('#project-create').click(); await p.locator('#project-status').getByText('Created project',{exact:false}).waitFor();
  await p.locator('#project-path').fill('src/main.txt'); await p.locator('#project-text').fill('hello server'); await p.locator('#project-save').click(); await p.locator('#project-status').getByText('Saved src/main.txt',{exact:false}).waitFor();
  await p.locator('#project-local-name').fill('local-copy.txt'); await p.locator('#project-to-local').click(); await p.locator('#project-status').getByText('Saved a new local copy',{exact:false}).waitFor();
  await p.locator('#project-to-local').click(); await p.locator('#project-status').getByText('already exists',{exact:false}).waitFor();
  // Another client writes a new revision; the editor must not overwrite it.
  await p.evaluate(async ({name,token})=>{const u='/api/v1/projects/'+name+'/files/src/main.txt'; const h={Authorization:'Bearer '+token};const old=await (await fetch(u,{headers:h})).json(); await fetch(u,{method:'PUT',headers:{...h,'Content-Type':'application/json'},body:JSON.stringify({content:'remote changed',revision:old.revision})});},{name,token});
  await p.locator('#project-text').fill('my unsaved edit'); await p.locator('#project-save').click(); await p.locator('#project-status').getByText('Revision conflict',{exact:false}).waitFor();
  check(await p.locator('#project-text').inputValue()==='my unsaved edit','conflict lost editor text');
  p.once('dialog',d=>d.dismiss()); await p.locator('#project-new-file').click(); check(await p.locator('#project-text').inputValue()==='my unsaved edit','cancel discarded edits');
  p.once('dialog',d=>d.accept()); await p.locator('#project-files').selectOption('src/main.txt'); await p.locator('#project-open').click(); await p.locator('#project-status').getByText('Opened src/main.txt',{exact:false}).waitFor(); check(await p.locator('#project-text').inputValue()==='remote changed','remote open mismatch');
  await p.locator('#project-from-local').click(); await p.locator('#project-status').getByText('Loaded saved local',{exact:false}).waitFor(); check(await p.locator('#project-text').inputValue()==='hello server','local import mismatch');
  p.once('dialog',d=>d.accept()); await p.locator('#project-new-file').click(); await p.locator('#project-files').selectOption('src/main.txt'); await p.locator('#project-open').click(); await p.locator('#project-status').getByText('Opened src/main.txt',{exact:false}).waitFor();
  await p.screenshot({path:'/home/user/linuxhtml-server-projects.png'});
  p.once('dialog',d=>d.accept()); await p.locator('#project-delete').click(); await p.locator('#project-status').getByText('Deleted src/main.txt',{exact:false}).waitFor();
  await p.locator('#project-disconnect').click(); check(await p.locator('#project-connected').isHidden(),'disconnect failed');
  check(errors.length===0,'page errors: '+errors.join(', ')); return 'PASS: auth, project create, nested server file, safe local transfer, stale conflict, unsaved protection, open, delete, disconnect';
 } finally {await ctx.close()}
}
