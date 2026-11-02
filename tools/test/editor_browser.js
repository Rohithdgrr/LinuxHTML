// Serve build/pwa on :8765, then run with playwright-cli.
async page => {
  const browser=page.context().browser(), errors=[];
  for (const mobile of [false,true]) {
    const ctx=await browser.newContext({serviceWorkers:'block',viewport:mobile?{width:320,height:640}:{width:1280,height:800},isMobile:mobile,hasTouch:mobile});
    const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
    const check=(v,m)=>{if(!v)throw new Error((mobile?'mobile: ':'desktop: ')+m)};
    try {
      await p.goto('http://127.0.0.1:8765/');
      await p.getByRole('button',{name:'Open Files and editor'}).click();
      const editor=p.locator('#filecontent');
      await p.locator('#filename').fill('find-test.txt');
      await editor.fill('Alpha a.b ALPHA a.b\nनमस्ते');
      await editor.focus();await p.keyboard.press('Control+f');
      check(await p.locator('#editor-find-panel').evaluate(e=>e.open),'Find shortcut did not open panel');
      await p.locator('#editor-find').fill('a.b');
      await p.locator('#editor-replace').fill('$&[x]');
      await p.locator('#editor-next').click();
      check((await p.locator('#editor-find-status').innerText()).includes('of 2'),'Literal search did not find two matches');
      await p.locator('#editor-replace-one').click();
      check((await editor.inputValue()).includes('$&[x] ALPHA a.b'),'Single literal replacement failed');
      await p.locator('#editor-find').fill('alpha');
      await p.locator('#editor-replace').fill('beta');
      await p.locator('#editor-match-case').check();
      await p.locator('#editor-next').click();
      check((await p.locator('#editor-find-status').innerText()).includes('No matches'),'Match case not respected');
      await p.locator('#editor-match-case').uncheck();
      p.once('dialog',d=>d.dismiss());await p.locator('#editor-replace-all').click();
      check((await editor.inputValue()).startsWith('Alpha'),'Cancelled replacement changed text');
      p.once('dialog',d=>d.accept());await p.locator('#editor-replace-all').click();
      check((await editor.inputValue())==='beta $&[x] beta a.b\nनमस्ते','Replace all failed');
      await editor.focus();await p.keyboard.press('Control+s');
      await p.waitForFunction(()=>document.querySelector('#file-status').textContent.startsWith('Saved find-test.txt'));
      await p.reload();await p.getByRole('button',{name:'Open Files and editor'}).click();
      await p.waitForFunction(()=>[...document.querySelector('#file-list').options].some(o=>o.value==='find-test.txt'));
      await p.locator('#file-list').selectOption('find-test.txt');await p.locator('#load-local').click();
      await p.waitForFunction(()=>document.querySelector('#file-status').textContent.startsWith('Opened'));
      check((await editor.inputValue())==='beta $&[x] beta a.b\nनमस्ते','Saved replacement did not persist');
    } finally {await ctx.close()}
  }
  if(errors.length)throw new Error('Page errors: '+errors.join(', '));
  return 'PASS: desktop and mobile editor search, literal replacement, case, cancel, shortcuts and persistence';
}
