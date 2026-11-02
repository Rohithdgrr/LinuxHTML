// Run against a server hosting build/pwa:
// playwright-cli -s=arena open http://127.0.0.1:8765/ --browser=chromium
// playwright-cli -s=arena run-code "$(cat tools/test/workspace_browser.js)"
async page => {
  const context = await page.context().browser().newContext({ serviceWorkers: 'block' });
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  try {
    const a = await context.newPage();
    await a.goto('http://127.0.0.1:8765/');
    // Exercise workspace independently of the VM; a separate smoke test covers boot.
    await a.getByRole('button', { name: 'Open Files and editor' }).click();
    await a.locator('#filename').fill('test.txt');
    await a.locator('#filecontent').fill('first');
    await a.locator('#save-local').click();
    await a.waitForFunction(() => document.querySelector('#file-status').textContent.startsWith('Saved'));
    const b = await context.newPage();
    await b.goto('http://127.0.0.1:8765/');
    await b.getByRole('button', { name: 'Open Files and editor' }).click();
    await b.waitForFunction(() => [...document.querySelector('#file-list').options].some(o => o.value === 'test.txt'));
    await b.locator('#file-list').selectOption('test.txt');
    await b.locator('#load-local').click();
    await b.waitForFunction(() => document.querySelector('#file-status').textContent.startsWith('Opened'));
    await a.locator('#filecontent').fill('second');
    await a.locator('#save-local').click();
    await a.waitForFunction(() => document.querySelector('#file-status').textContent.startsWith('Saved'));
    await b.locator('#filecontent').fill('stale');
    await b.locator('#save-local').click();
    await b.waitForFunction(() => document.querySelector('#file-status').textContent.startsWith('Save failed'));
    check((await b.locator('#file-status').innerText()).includes('changed'), 'Stale save was not rejected');
    let warning = '';
    await b.getByRole('button', { name: 'Open Terminal' }).click();
    await b.evaluate(() => document.querySelector('#vm-section').hidden = false);
    b.once('dialog', async dialog => { warning = dialog.message(); await dialog.dismiss(); });
    await b.locator('#restart').click();
    check(warning.includes('Temporary guest state'), 'Restart did not warn of guest data loss');
    await b.getByRole('button', { name: 'Open Files and editor' }).click();
    b.once('dialog', dialog => dialog.accept());
    await b.locator('#import-file').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    await b.waitForFunction(() => document.querySelector('#file-status').textContent.startsWith('Imported notes.txt'));
    check(await b.locator('#filecontent').inputValue() === 'hello', 'Import failed');
    check((await b.locator('#file-status').innerText()).includes('Save locally'), 'Import must warn that it is unsaved');
    const aba = await b.evaluate(async () => {
      const m = await import('./workspace.js');
      const db = await m.openWorkspace();
      const old = await m.saveFile(db, 'aba.txt', 'old', null);
      await m.deleteFile(db, 'aba.txt', old.revision);
      const current = await m.saveFile(db, 'aba.txt', 'new', null);
      let saveRejected = false, deleteRejected = false;
      try { await m.saveFile(db, 'aba.txt', 'stale', old.revision); } catch { saveRejected = true; }
      try { await m.deleteFile(db, 'aba.txt', old.revision); } catch { deleteRejected = true; }
      return { saveRejected, deleteRejected, different: old.revision !== current.revision };
    });
    check(aba.saveRejected && aba.deleteRejected && aba.different, 'Delete/recreate conflict was not detected');
    return 'PASS: local workspace conflict, delete/recreate, import, and restart warning';
  } finally { await context.close(); }
}
