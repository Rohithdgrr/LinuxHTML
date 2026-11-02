// With build/pwa served on :8765 and an open arena Playwright session:
// playwright-cli -s=arena run-code "$(cat tools/test/calculator_browser.js)"
async page => {
  const ctx=await page.context().browser().newContext({serviceWorkers:'block',viewport:{width:1280,height:800}});
  const p=await ctx.newPage(); const errors=[]; p.on('pageerror',e=>errors.push(e.message));
  const check=(v,m)=>{if(!v)throw new Error(m)};
  try {
    await p.goto('http://127.0.0.1:8765/');
    await p.getByRole('button',{name:'Open app launcher'}).click();
    await p.getByRole('button',{name:'Calculator Quick calculations'}).click();
    const input=p.locator('#calc-expression'), result=p.locator('#calc-result'), msg=p.locator('#calc-message');
    for(const [expression,expected] of [['2+3*4','14'],['(2+3)*4','20'],['-3.5*2','-7'],['0.1+0.2','0.3'],['1e3/4','250']]) {
      await input.fill(expression); await input.press('Enter'); check(await result.innerText()===expected,`${expression} incorrect: ${await result.innerText()}`);
    }
    await input.fill('8/0'); await input.press('Enter'); check((await msg.innerText()).includes('divide by zero'),'Missing division by zero error');
    await input.fill('2*(3+4'); await input.press('Enter'); check((await msg.innerText()).includes('parenthesis'),'Missing parentheses error');
    await input.fill('globalThis.pwned=1'); await input.press('Enter'); check(!(await p.evaluate(()=>window.pwned)),'Unexpected code execution');
    await input.fill('('.repeat(40)+'1'+')'.repeat(40)); await input.press('Enter'); check((await msg.innerText()).includes('nested'),'Nesting limit failed');
    await p.getByRole('button',{name:'Clear',exact:true}).click();
    await p.locator('[data-calc="7"]').click(); await p.getByRole('button',{name:'Multiply'}).click(); await p.locator('[data-calc="8"]').click(); await p.getByRole('button',{name:'Calculate',exact:true}).click();
    check(await result.innerText()==='56','Keypad calculation failed');
    await p.locator('[data-calc="1"]').click(); await p.locator('#calc-copy').click(); check((await msg.innerText()).includes('Calculate a result'),'Stale result could be copied');
    check(errors.length===0,'Page errors: '+errors.join(', '));
    return 'PASS: precedence, parentheses, unary, decimals, exponent, errors, parser safety and keypad';
  } finally { await ctx.close(); }
}
