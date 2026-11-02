// Serve build/pwa on :8765, then run with playwright-cli.
async page => {
  const ctx=await page.context().browser().newContext({serviceWorkers:'allow',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  try {
    await p.goto('http://127.0.0.1:8765/');
    await p.getByRole('button',{name:'Open Settings'}).tap();
    await p.waitForFunction(()=>!document.querySelector('#app-update-status').textContent.includes('Checking offline'));
    await p.locator('#check-browser-storage').tap();
    await p.waitForFunction(()=>document.querySelector('#browser-storage-status').textContent.includes('not a backup'));
    await p.locator('#check-app-update').tap();
    await p.waitForFunction(()=>document.querySelector('#app-update-status').textContent.includes('Update check complete'));
    if(errors.length) throw new Error(errors.join(', '));
    return 'PASS: mobile settings expose storage estimate and manual update check';
  } finally {await ctx.close()}
}
