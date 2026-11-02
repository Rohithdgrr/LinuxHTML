// Serve build/pwa on :8765, then run with playwright-cli.
async page => {
  const browser=page.context().browser();
  for(const mobile of [false,true]) {
    const ctx=await browser.newContext({serviceWorkers:'block',viewport:mobile?{width:320,height:640}:{width:1280,height:800},isMobile:mobile,hasTouch:mobile});
    const p=await ctx.newPage(), errors=[];p.on('pageerror',e=>errors.push(e.message));
    const check=(v,m)=>{if(!v)throw new Error((mobile?'mobile: ':'desktop: ')+m)};
    try {
      await p.goto('http://127.0.0.1:8765/');
      await p.getByRole('button',{name:'Open Files and editor'}).click();
      if (!mobile) {
        const title=p.locator('[data-window="workspace"] .window-titlebar');
        await title.focus();await p.keyboard.press('ArrowRight');await p.keyboard.press('ArrowDown');
      }
      const before=await p.locator('[data-window="workspace"]').boundingBox();
      if(!mobile) await p.getByRole('button',{name:'Maximize Files and editor'}).click();
      await p.getByRole('button',{name:'Open Terminal',exact:true}).click();
      await p.getByRole('button',{name:'Open Settings',exact:true}).click();
      await p.locator('#save-layout').click();
      await p.waitForFunction(()=>document.querySelector('#layout-status').textContent.startsWith('Saved 2 open app'));
      const saved=await p.evaluate(()=>localStorage.getItem('linuxhtml-desktop-layout-v1'));
      check(!saved.includes('Hello from LinuxHTML'),'Layout must not contain editor contents');
      await p.reload();
      await p.getByRole('button',{name:'Open Settings',exact:true}).click();
      // Validate all entries before opening any window.
      await p.evaluate(()=>localStorage.setItem('linuxhtml-desktop-layout-v1',JSON.stringify({version:1,windows:[{name:'terminal',maximized:false,geometry:null},{name:'not-an-app',maximized:false,geometry:null}]})));
      await p.locator('#restore-layout').click();
      check((await p.locator('#layout-status').innerText()).includes('invalid'),'Corrupt layout not rejected');
      check(!(await p.locator('[data-window="terminal"]').isVisible()),'Invalid layout partially applied');
      await p.evaluate(saved=>localStorage.setItem('linuxhtml-desktop-layout-v1',saved),saved);
      await p.getByRole('button',{name:'Open Notes',exact:true}).click();
      await p.locator('#note-text').fill('Unfinished draft');
      await p.getByRole('button',{name:'Open Settings',exact:true}).click();
      await p.locator('#restore-layout').click();
      check(await p.locator('[data-window="workspace"]').isVisible(),'Workspace not restored');
      check(await p.locator('[data-window="terminal"]').isVisible(),'Terminal not restored');
      check(await p.locator('[data-window="notes"]').isVisible(),'Other window closed');
      check((await p.locator('#note-text').inputValue())==='Unfinished draft','Draft changed');
      check(await p.locator('#first-run').isVisible(),'Restoring layout unexpectedly started VM');
      check(!(await p.evaluate(()=>!!window.linuxhtmlVM)),'Restoring layout started VM');
      if(!mobile) {check(await p.locator('[data-window="workspace"]').evaluate(e=>e.classList.contains('maximized')),'Maximize state not restored');await p.getByRole('button',{name:'Restore Files and editor'}).click();const after=await p.locator('[data-window="workspace"]').boundingBox();check(Math.abs(before.x-after.x)<3&&Math.abs(before.y-after.y)<3,'Window position not restored');await p.getByRole('button',{name:'Open Settings',exact:true}).click();}
      else {const box=await p.locator('[data-window="workspace"]').boundingBox();check(box.x>=0&&box.x+box.width<=320&&box.y+box.height<=640,'Mobile window outside viewport');}
      await p.locator('#clear-layout').click();
      check((await p.locator('#layout-status').innerText()).includes('cleared'),'Clear failed');
      check(await p.locator('[data-window="notes"]').isVisible(),'Clear closed a window');
      check(errors.length===0,errors.join(', '));
    } finally {await ctx.close()}
  }
  const blocked=await browser.newContext({serviceWorkers:'block'}), p=await blocked.newPage();
  try {
    await p.addInitScript(() => Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Storage blocked','SecurityError')}}));
    await p.goto('http://127.0.0.1:8765/');await p.getByRole('button',{name:'Open Settings'}).click();await p.locator('#save-layout').click();
    if(!(await p.locator('#layout-status').innerText()).includes('Could not save layout')) throw new Error('Blocked storage not reported');
  } finally {await blocked.close()}
  return 'PASS: desktop and mobile layout restore, positions, maximize, drafts, invalid data, blocked storage and no VM auto-start';
}
