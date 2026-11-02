// Serve build/pwa on 8765; run through playwright-cli.
async page => {
 const ctx=await page.context().browser().newContext({serviceWorkers:'block', viewport:{width:1280,height:900}}),p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 const includes=t=>{const b=window.linuxhtmlTerminal?.buffer.active;return b&&Array.from({length:b.length},(_,i)=>b.getLine(i)?.translateToString(true)).join('\n').includes(t)};
 try {
  await p.goto('http://127.0.0.1:8765/');await p.getByRole('button',{name:'Open Terminal'}).click();await p.getByRole('button',{name:'Acknowledge & start Linux'}).click();await p.waitForFunction(()=>window.linuxhtmlGuestReady,null,{timeout:90000});
  await p.locator('.xterm-helper-textarea').focus(); await p.keyboard.type('echo local-persist-ok > /tmp/checkpoint; echo share-persist-ok > /mnt/checkpoint; sync; echo snapshot-ready');await p.keyboard.press('Enter'); await p.waitForFunction(includes,'snapshot-ready',{timeout:15000});
  p.once('dialog',d=>d.accept());await p.locator('#save-checkpoint').click();await p.locator('#status').getByText('Saved a ',{exact:false}).waitFor({timeout:50000});
  await p.reload();await p.getByRole('button',{name:'Open Terminal'}).click();await p.locator('#restore-checkpoint').check();await p.getByRole('button',{name:'Acknowledge & start Linux'}).click();
  await p.locator('#status').getByText('Checkpoint restored.',{exact:false}).waitFor({timeout:90000});await p.waitForTimeout(1500);await p.locator('.xterm-helper-textarea').focus(); await p.keyboard.press('Enter');await p.waitForFunction(()=>window.linuxhtmlGuestReady,null,{timeout:20000});
  await p.keyboard.type('cat /tmp/checkpoint /mnt/checkpoint');await p.keyboard.press('Enter');await p.waitForFunction(includes,'local-persist-ok',{timeout:15000});await p.waitForFunction(includes,'share-persist-ok',{timeout:15000});
  await p.screenshot({path:'/home/user/linuxhtml-checkpoint.png'});
  p.once('dialog',d=>d.accept());await p.locator('#delete-checkpoint').click();await p.locator('#status').getByText('Saved checkpoint deleted.').waitFor();
  if(errors.length)throw Error(errors.join('; '));return 'PASS: save, reload, restore and delete; guest /tmp and 9P files persisted';
 } finally {await ctx.close();}
}
