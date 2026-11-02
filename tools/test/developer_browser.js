// With the PWA served on :8765 and arena session open:
// playwright-cli -s=arena run-code "$(cat tools/test/developer_browser.js)"
async page => {
  const ctx = await page.context().browser().newContext({serviceWorkers:'block', viewport:{width:1280,height:800}});
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const check = (v, m) => { if (!v) throw new Error(m); };
  try {
    await p.goto('http://127.0.0.1:8765/');
    await p.getByRole('button',{name:'Open Files and editor'}).click();
    await p.locator('#filecontent').fill('unsaved changes');
    await p.getByRole('button',{name:'Open Dev Studio'}).click();
    let prompt = '';
    p.once('dialog', async d => { prompt = d.message(); await d.dismiss(); });
    await p.locator('#dev-open-template').click();
    check(prompt.includes('Unsaved changes'), 'No unsaved change warning');
    check(await p.locator('#filecontent').inputValue() === 'unsaved changes', 'Cancel discarded unsaved text');
    p.once('dialog', d => d.accept());
    await p.locator('#dev-open-template').click();
    check(await p.locator('#filename').inputValue() === 'hello.sh', 'Template name incorrect');
    await p.locator('#save-local').click();
    await p.waitForFunction(()=>document.querySelector('#file-status').textContent.startsWith('Saved'));
    await p.getByRole('button',{name:'Open Terminal'}).click();
    await p.getByRole('button',{name:'Acknowledge & start Linux'}).click();
    await p.waitForFunction(()=>window.linuxhtmlGuestReady === true,null,{timeout:90000});
    await p.getByRole('button',{name:'Open Files and editor'}).click();
    await p.locator('#send-file').click();
    await p.waitForFunction(()=>document.querySelector('#file-status').textContent.startsWith('Sent'));
    await p.getByRole('button',{name:'Open Terminal'}).click();
    await p.evaluate(()=>window.linuxhtmlVM.serial0_send('sh /mnt/hello.sh\n'));
    await p.waitForFunction(()=>Array.from({length:window.linuxhtmlTerminal.buffer.active.length},(_,i)=>window.linuxhtmlTerminal.buffer.active.getLine(i)?.translateToString(true)).join('\n').includes('Hello from LinuxHTML!'),null,{timeout:15000});
    await p.reload();
    await p.getByRole('button',{name:'Open Files and editor'}).click();
    await p.waitForFunction(()=>[...document.querySelector('#file-list').options].some(o=>o.value==='hello.sh'));
    await p.locator('#file-list').selectOption('hello.sh'); await p.locator('#load-local').click();
    await p.waitForFunction(()=>document.querySelector('#file-status').textContent.startsWith('Opened'));
    check((await p.locator('#filecontent').inputValue()).includes('Hello from LinuxHTML'), 'Saved template not restored');
    check(errors.length === 0, 'Page errors: '+errors.join(', '));
    return 'PASS: unsaved protection, template, local save/reload, guest transfer and shell execution';
  } finally { await ctx.close(); }
}
