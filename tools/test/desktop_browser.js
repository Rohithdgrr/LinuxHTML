// Start the local PWA server, open an arena session, then run:
// playwright-cli -s=arena run-code "$(cat tools/test/desktop_browser.js)"
async page => {
  const ctx = await page.context().browser().newContext({serviceWorkers: 'block', viewport: {width: 1280, height: 800}});
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  try {
    await p.goto('http://127.0.0.1:8765/');
    await p.getByRole('button', {name:'Open Files and editor'}).click();
    const win = p.locator('[data-window="workspace"]');
    const before = await win.boundingBox();
    const title = p.locator('[data-window="workspace"] .window-titlebar');
    const t = await title.boundingBox();
    await p.mouse.move(t.x + 200, t.y + 30); await p.mouse.down(); await p.mouse.move(t.x + 240, t.y + 10, {steps:4}); await p.mouse.up();
    const moved = await win.boundingBox();
    check(moved.x > before.x + 10 && moved.y < before.y - 10, 'Window drag did not move');
    const resize = p.getByRole('button', {name:'Resize Files and editor. Use arrow keys.'});
    await resize.focus(); await p.keyboard.press('ArrowLeft');
    const resized = await win.boundingBox();
    check(resized.width < moved.width - 10, 'Keyboard resize did not work');
    await p.getByRole('button', {name:'Maximize Files and editor'}).click();
    check(await win.evaluate(e => e.classList.contains('maximized')), 'Maximize failed');
    await p.getByRole('button', {name:'Restore Files and editor'}).click();
    const restored = await win.boundingBox();
    check(Math.abs(restored.width - resized.width) < 3, 'Restore did not preserve size');
    await p.getByRole('button', {name:'Minimize Files and editor'}).click();
    check(!(await win.isVisible()), 'Minimize failed');
    await p.getByRole('button', {name:'Open Files and editor'}).click();
    check(await win.isVisible(), 'Dock restore failed');
    await p.getByRole('button', {name:'Open Settings'}).click();
    await p.getByRole('button', {name:'Midnight'}).click();
    check((await p.locator('#theme-status').innerText()).includes('saved'), 'Theme save failed');
    await p.reload();
    check(await p.locator('#desktop').getAttribute('data-theme') === 'night', 'Theme did not persist');
    check(errors.length === 0, `Page errors: ${errors.join(', ')}`);
    return 'PASS: drag, keyboard resize, maximize/restore, minimize/dock restore, theme persistence';
  } finally { await ctx.close(); }
}
