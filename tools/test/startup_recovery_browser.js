// Serve build/pwa on :8765 and run with playwright-cli.
async page => {
  const ctx=await page.context().browser().newContext({serviceWorkers:'block',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const p=await ctx.newPage(), errors=[];p.on('pageerror',e=>errors.push(e.message));
  try {
    let phase='http-error';
    await p.route('**/assets/libv86.js', async route => {
      if(phase==='http-error') { await new Promise(resolve=>setTimeout(resolve,500)); return route.fulfill({status:503,body:'Unavailable'}); }
      if(phase==='corrupt') return route.fulfill({status:200,body:'tampered'});
      return route.continue();
    });
    await p.goto('http://127.0.0.1:8765/');
    await p.getByRole('button',{name:'Open Terminal',exact:true}).tap();
    await p.getByRole('button',{name:'Acknowledge & start Linux'}).tap();
    await p.locator('#start-progress').waitFor({state:'visible'});
    await p.waitForFunction(()=>document.querySelector('#start-progress').textContent.includes('libv86.js'));
    await p.waitForFunction(()=>document.querySelector('#start-error').textContent.includes('Could not download libv86.js'));
    const message=await p.locator('#start-error').innerText();
    if(!message.includes('503') || !message.includes('try again')) throw new Error('Unhelpful failure: '+message);
    if(await p.getByRole('button',{name:'Acknowledge & start Linux'}).isDisabled()) throw new Error('Start remained disabled after failure');
    phase='corrupt';
    await p.getByRole('button',{name:'Acknowledge & start Linux'}).tap();
    await p.waitForFunction(()=>document.querySelector('#start-error').textContent.includes('Integrity check failed: libv86.js'));
    if(await p.getByRole('button',{name:'Acknowledge & start Linux'}).isDisabled()) throw new Error('Start remained disabled after integrity failure');
    phase='success';
    await p.getByRole('button',{name:'Acknowledge & start Linux'}).tap();
    await p.waitForFunction(()=>window.linuxhtmlGuestReady===true,null,{timeout:120000});
    await p.locator('#mobile-command').fill('echo RETRY_OK');await p.locator('#mobile-command-form button').tap();
    await p.waitForFunction(()=>{const b=linuxhtmlTerminal.buffer.active;return Array.from({length:b.length},(_,i)=>b.getLine(i)?.translateToString(true)).join('\n').includes('\nRETRY_OK')},null,{timeout:15000});
    if(errors.length)throw new Error(errors.join(', '));
    return 'PASS: visible startup progress, download and integrity failure, enabled retry and working Linux shell';
  } finally {await ctx.close()}
}
