// Run with a built PWA served on :8765 and an open arena Playwright session.
// playwright-cli -s=arena run-code "$(cat tools/test/learning_browser.js)"
async page => {
  const ctx = await page.context().browser().newContext({serviceWorkers:'block', viewport:{width:1280,height:800}});
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  const assert = (v, message) => { if (!v) throw new Error(message); };
  try {
    await p.goto('http://127.0.0.1:8765/');
    await p.getByRole('button', {name:'Open Learn Linux'}).click();
    await p.locator('#check-lesson').click();
    assert((await p.locator('#lesson-feedback').innerText()).includes('Start the Linux VM'), 'Missing VM warning');
    await p.getByRole('button', {name:'Open terminal ↗'}).click();
    await p.getByRole('button', {name:'Acknowledge & start Linux'}).click();
    await p.waitForFunction(() => window.linuxhtmlGuestReady === true, null, {timeout:90000});
    await p.getByRole('button', {name:'Close Terminal'}).click();
    await p.locator('#check-lesson').click();
    await p.waitForFunction(() => document.querySelector('#lesson-feedback').textContent.includes('File not found'));
    const firstPath = (await p.locator('#lesson-command').innerText()).match(/\/mnt\/[a-z0-9-]+\.txt/)[0].replace('/mnt/', '/');
    await p.evaluate(path => linuxhtmlVM.create_file(path, new TextEncoder().encode('wrong')), firstPath);
    await p.locator('#check-lesson').click();
    await p.waitForFunction(() => document.querySelector('#lesson-feedback').textContent.includes('Not quite'));
    for (const title of ['Say hello to Linux', 'Make a two-line file', 'Try your first pipe']) {
      if (!(await p.locator('#lesson-title').innerText()).includes(title)) await p.locator('.lesson-card').filter({hasText:title}).click();
      const command = await p.locator('#lesson-command').innerText();
      const path = command.match(/\/mnt\/[a-z0-9-]+\.txt/)[0].replace('/mnt/', '/');
      await p.evaluate(command => window.linuxhtmlVM.serial0_send(command + '\n'), command);
      await p.waitForFunction(async path => { try { await window.linuxhtmlVM.read_file(path); return true; } catch { return false; } }, path, {timeout:15000});
      await p.waitForTimeout(1000);
      await p.locator('#check-lesson').click();
      await p.waitForFunction(() => document.querySelector('#lesson-feedback').textContent.includes('Exercise complete'));
    }
    assert((await p.locator('#lesson-progress').innerText()).includes('3 / 3'), 'Progress not recorded');
    const old = await p.locator('#lesson-command').innerText();
    p.once('dialog', d => d.accept());
    await p.locator('#reset-lesson').click();
    const fresh = await p.locator('#lesson-command').innerText();
    assert(old !== fresh, 'New attempt should use a different path');
    await p.locator('#check-lesson').click();
    await p.waitForFunction(() => document.querySelector('#lesson-feedback').textContent.includes('File not found'));
    await p.reload();
    await p.getByRole('button', {name:'Open Learn Linux'}).click();
    assert((await p.locator('#lesson-progress').innerText()).includes('2 / 3'), 'Progress not persisted after reset');
    assert(errors.length === 0, 'Page errors: ' + errors.join(', '));
    return 'PASS: real guest executes three lessons; checks, reset and progress persistence';
  } finally { await ctx.close(); }
}
