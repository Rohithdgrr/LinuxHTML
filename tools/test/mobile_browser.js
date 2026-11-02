// Serve build/pwa on port 8765, then run this script with playwright-cli.
async page => {
  const browser=page.context().browser();
  const ctx=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const p=await ctx.newPage(), errors=[];p.on('pageerror',e=>errors.push(e.message));
  const check=(v,m)=>{if(!v)throw new Error(m)};
  try {
    await p.goto('http://127.0.0.1:8765/');
    await p.getByRole('button',{name:'Open Notes',exact:true}).tap();
    await p.locator('#note-text').fill('Mobile note\nSaved on this device');await p.locator('#note-save').tap();
    await p.waitForFunction(()=>document.querySelector('#note-status').textContent.startsWith('Note saved'));
    await p.waitForFunction(()=>document.querySelector('#note-count').textContent==='1');
    await p.getByRole('button',{name:'Open Dev Studio',exact:true}).tap();
    await p.locator('[data-template="system"]').tap();await p.locator('#dev-open-template').tap();
    check((await p.locator('#filecontent').inputValue()).includes('uname -a'),'Template not opened');
    await p.locator('#save-local').tap();await p.waitForFunction(()=>document.querySelector('#file-status').textContent.includes('Saved'));
    await p.getByRole('button',{name:'Open app launcher'}).tap();
    await p.getByRole('button',{name:'Calculator Quick calculations'}).tap();
    await p.locator('#calc-expression').fill('2+3*4');await p.locator('[data-calc="equals"]').tap();
    check((await p.locator('#calc-result').innerText()).includes('14'),'Calculator failed');
    await p.getByRole('button',{name:'Open Terminal',exact:true}).tap();
    await p.getByRole('button',{name:'Acknowledge & start Linux'}).tap();
    await p.waitForFunction(()=>window.linuxhtmlGuestReady===true,null,{timeout:120000});
    await p.locator('#mobile-command').fill('echo MOBILE_TERMINAL_OK');await p.locator('#mobile-command-form button').tap();
    await p.waitForFunction(()=>{const b=linuxhtmlTerminal.buffer.active;return Array.from({length:b.length},(_,i)=>b.getLine(i)?.translateToString(true)).join('\n').includes('\nMOBILE_TERMINAL_OK')},null,{timeout:15000});
    await p.getByRole('button',{name:'Open Learn Linux',exact:true}).tap();
    await p.locator('#type-lesson').tap();await p.locator('[data-terminal-key="enter"]').tap();
    await p.getByRole('button',{name:'Open Learn Linux',exact:true}).tap();
    await p.locator('#check-lesson').tap();
    await p.waitForFunction(()=>document.querySelector('#lesson-feedback').textContent.includes('Exercise complete'),null,{timeout:15000});
    await p.setViewportSize({width:320,height:568});
    const dims=await p.evaluate(()=>{let w=document.querySelector('[data-window="learn"]'),r=w.getBoundingClientRect();return {x:r.x,right:r.right,bottom:r.bottom, width:innerWidth,height:innerHeight}});
    check(dims.x>=0&&dims.right<=dims.width&&dims.bottom<=dims.height,'Window out of mobile viewport '+JSON.stringify(dims));
    await p.getByRole('button',{name:'Close Learn Linux'}).tap();
    await p.getByRole('button',{name:'Open Notes',exact:true}).tap();
    check((await p.locator('#note-count').innerText())==='1','Saved notes missing');
    check(errors.length===0,'Page errors: '+errors.join(', '));
    return 'PASS: mobile notes, Dev Studio, editor, calculator, real VM command, lesson and small viewport';
  } finally {await ctx.close()}
}
