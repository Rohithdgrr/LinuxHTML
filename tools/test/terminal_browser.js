// Start local PWA server and open an arena browser session, then run:
// playwright-cli -s=arena run-code "$(cat tools/test/terminal_browser.js)"
async page => {
  const ctx=await page.context().browser().newContext({serviceWorkers:'block',viewport:{width:1280,height:800}});
  const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  const check=(v,m)=>{if(!v)throw new Error(m)};
  const buffer=()=>{const b=window.linuxhtmlTerminal.buffer.active;return Array.from({length:b.length},(_,i)=>b.getLine(i)?.translateToString(true)).join('\n')};
  try {
    await p.goto('http://127.0.0.1:8765/');await p.getByRole('button',{name:'Open Terminal'}).click();await p.getByRole('button',{name:'Acknowledge & start Linux'}).click();
    await p.waitForFunction(()=>window.linuxhtmlGuestReady===true,null,{timeout:90000});
    const tty=p.locator('.xterm-helper-textarea');await tty.focus();
    await p.keyboard.type("uname -r; mkdir /tmp/testdir; printf 'hello\\n' > /tmp/testdir/a; cat /tmp/testdir/a | tr a-z A-Z");await p.keyboard.press('Enter');
    await p.waitForFunction(()=>{const b=window.linuxhtmlTerminal.buffer.active;return Array.from({length:b.length},(_,i)=>b.getLine(i)?.translateToString(true)).join('\n').includes('HELLO')},null,{timeout:15000});
    const output=await p.evaluate(buffer);check(output.includes('6.8.12') && output.includes('HELLO'),'Linux command output missing');
    await p.keyboard.press('ArrowUp'); await p.waitForTimeout(300);
    check((await p.evaluate(buffer)).includes('uname -r; mkdir'),'Shell history did not respond');
    await p.keyboard.press('Control+c'); await p.waitForTimeout(300);
    await p.keyboard.type('printf interrupt_ok');await p.keyboard.press('Enter');
    await p.waitForFunction(()=>{const b=window.linuxhtmlTerminal.buffer.active;return Array.from({length:b.length},(_,i)=>b.getLine(i)?.translateToString(true)).join('\n').includes('interrupt_ok')},null,{timeout:15000});
    await p.getByRole('button',{name:'Close Terminal'}).click();await p.getByRole('button',{name:'Open Terminal'}).click();
    check(await p.locator('.xterm').isVisible(),'Terminal did not reopen');
    check(errors.length===0,'Browser errors: '+errors.join(', '));
    return 'PASS: Linux 6.8 shell, commands, pipe, history, Ctrl+C and reopen';
  } finally {await ctx.close();}
}
