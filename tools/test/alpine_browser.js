// Build --guest alpine, serve build/pwa-alpine on :8767, then run with playwright-cli.
async page => {
  const ctx=await page.context().browser().newContext({serviceWorkers:'block',viewport:{width:1280,height:900}}), p=await ctx.newPage();
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  const text=()=>{const b=window.linuxhtmlTerminal?.buffer.active;return b?Array.from({length:b.length},(_,i)=>b.getLine(i)?.translateToString(true)).join('\n'):''};
  try {
    await p.goto('http://127.0.0.1:8767/');await p.getByRole('button',{name:'Open Terminal'}).click();
    if(!(await p.locator('#first-run').innerText()).includes('Alpine Linux 3.24.3')) throw Error('Wrong guest disclosure');
    if (!(await p.locator('#restore-checkpoint').isDisabled())) throw Error('Alpine checkpoint restore must remain disabled');
    await p.getByRole('button',{name:'Acknowledge & start Linux'}).click();
    if (!(await p.locator('#save-checkpoint').isDisabled())) throw Error('Alpine checkpoint save must remain disabled');
    await p.waitForFunction(()=>{const b=window.linuxhtmlTerminal?.buffer.active;return b&&Array.from({length:b.length},(_,i)=>b.getLine(i)?.translateToString(true)).join('\n').includes('localhost login:')},null,{timeout:155000});
    await p.locator('.xterm-helper-textarea').focus();await p.keyboard.type('root');await p.keyboard.press('Enter');
    await p.waitForFunction(()=>window.linuxhtmlGuestReady===true,null,{timeout:20000});
    await p.keyboard.type('cat /etc/alpine-release; command -v apk; echo "alpine-9p-ok" > /mnt/guest.txt');await p.keyboard.press('Enter');
    await p.waitForFunction(async()=>{try {return new TextDecoder().decode(await window.linuxhtmlVM.read_file('/guest.txt')).includes('alpine-9p-ok')}catch{return false}},null,{timeout:15000});
    await p.waitForFunction(()=>{const b=window.linuxhtmlTerminal.buffer.active;const t=Array.from({length:b.length},(_,i)=>b.getLine(i)?.translateToString(true)).join('\n');return t.includes('3.24.3')&&t.includes('/sbin/apk')},null,{timeout:10000});
    await p.evaluate(()=>window.linuxhtmlVM.create_file('/host.txt',new TextEncoder().encode('host-transfer-ok')));
    await p.keyboard.type('cat /mnt/host.txt');await p.keyboard.press('Enter');
    await p.waitForFunction(()=>{const b=window.linuxhtmlTerminal.buffer.active;return Array.from({length:b.length},(_,i)=>b.getLine(i)?.translateToString(true)).join('\n').includes('host-transfer-ok')},null,{timeout:15000});
    await p.screenshot({path:'/home/user/linuxhtml-alpine-terminal.png'});if(errors.length)throw Error(errors.join('; '));
    return 'PASS: official Alpine 3.24.3 root login, apk present, automatic 9P mount and bidirectional transfer';
  } finally {await ctx.close();}
}
