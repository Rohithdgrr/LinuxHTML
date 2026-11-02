# User and development workflows

## Learner journey (target)
1. Open the site, review disclosure and start a new lesson.
2. Read objectives and short instructions beside a terminal.
3. Complete tasks in an isolated lesson environment; request optional hints.
4. Run checks and receive actionable pass/fail feedback.
5. Reset only the lesson environment or continue; save/export work before reset.
6. Track progress locally; optional accounts and instructor views are future work.

## Current working journey
1. Run `git submodule update --init --recursive`.
2. Run `python3 tools/fetch_vm_assets.py` and `python3 tools/pack.py --tier base --target pwa`.
3. Serve `build/pwa` over HTTP, e.g. `python3 -m http.server 8765 --directory build/pwa`.
4. Open Terminal from the desktop, acknowledge the experimental, obsolete guest warning and wait for the Linux prompt.
5. Open Files from the desktop. In the local text workspace, enter a simple filename and content; save, select, open, import, export or delete locally. Existing files must be opened before saving; stale cross-tab changes are rejected. Copy to `/mnt` or read back explicitly. Reload restarts the guest, not the local workspace.

## Developer workflow
Create a focused branch; agree on acceptance criteria and threat model; implement source, tests and documentation together; run the packaging tests and browser checks; review diffs and dependency licenses; publish a versioned build only after gates pass. Never commit generated secrets or claim successful tests not run.

## CI and release workflow
Pull requests should run unit, packaging, accessibility and browser smoke tests, including corrupt artifacts and offline startup. Release should verify provenance and hashes, test supported browsers, produce a versioned artifact and publish release notes. A signing mechanism, rollback process and incident response are required before claiming authenticated releases. `.github/workflows/pages.yml` builds and deploys the experimental base PWA; deployment still requires an authorized push/workflow run.

## Reset/data workflow
Separate “restart guest,” “reset lesson,” “delete local files,” and “clear all data.” Explain the scope and request confirmation for destructive actions. Current Restart requests confirmation, reloads and erases the temporary guest; it does not delete the local IndexedDB workspace.

## Workspace browser regression
Start the local server, then run `playwright-cli -s=arena open http://127.0.0.1:8765/ --browser=chromium` followed by `playwright-cli -s=arena run-code "$(cat tools/test/workspace_browser.js)"`. This checks conflicts, deletion/recreation, text import and restart confirmation; it does not replace the VM boot smoke test.

## Desktop window controls
Open apps from the dock, launcher or desktop. Drag a title bar or focus it and use arrow keys to move; use the bottom-right resize handle or focus it and use arrow keys to resize. Minimize and reopen from the dock, maximize and restore, or close. Closing or minimizing the terminal hides it without stopping the guest. Themes save in browser local storage when available.

Desktop regression: after opening a local Playwright session, run `playwright-cli -s=arena run-code "$(cat tools/test/desktop_browser.js)"`.

## Try the learning lab
Open Learn Linux, select one of the three lessons, then open Terminal and start the VM. Run the example command, return to the lesson and choose Check my work. “Type example in terminal” types without executing; review it and press Enter. New attempt resets that lesson’s progress and creates a new target name, but does not delete previous guest files. Progress is saved locally when browser storage permits.

After starting a local server and opening the Playwright session, run `playwright-cli -s=arena run-code "$(cat tools/test/learning_browser.js)"` to exercise all three lessons against the guest, including incorrect answers and new attempts.

## Try Dev Studio
Open Dev Studio, choose a shell starter and select Open in editor. The editor warns before replacing unsaved content. Save locally, start the guest in Terminal, return to the editor and copy the text to `/mnt`, then run `sh /mnt/hello.sh` (or the filename you saved). The guest file is temporary; local storage may be evicted, so export important work. Templates do not execute automatically. Python, Node and Git are not available in the current demo guest.

With the local server and Playwright session running, use `playwright-cli -s=arena run-code "$(cat tools/test/developer_browser.js)"` to exercise template handoff, unsaved-change warning, local save/reload, guest transfer and real shell execution.

## Backup and restore
Open Settings → Open backups. Download backup exports saved local text files only to an unencrypted JSON file; keep it private. To restore, choose a version-1 LinuxHTML backup and confirm. Import is atomic and never overwrites: if even one name exists locally, no files are imported. Guest data, unsaved editor text, themes and learning progress are excluded. Limit is 500 files and 5 MiB.

After starting the local server and Playwright session, run `playwright-cli -s=arena run-code "$(cat tools/test/backup_browser.js)"` to test export, invalid inputs, atomic conflict rollback and restore.

## Notes
Open Notes from the desktop or dock. Write text and select Save note; its first non-empty line is the displayed title. Search filters locally. Switching notes or starting a new one prompts before discarding unsaved edits. Saved notes are local workspace text files and included in the unencrypted Backups export. Browser storage may be cleared or evicted; maintain independent backups.

With a local server and Playwright session running, use `playwright-cli -s=arena run-code "$(cat tools/test/notes_browser.js)"` to exercise save, search, conflict handling, backup and restore.

## Calculator
Open the app launcher and choose Calculator. Enter an expression or use the keypad; press Enter or Calculate. It supports addition, subtraction, multiplication, division, parentheses and typed scientific notation. Results use floating-point arithmetic, not exact financial decimal math. Clipboard access is optional and depends on browser permission. The app can run offline after its resources are cached.

Regression: `playwright-cli -s=arena run-code "$(cat tools/test/calculator_browser.js)"` with the local server and Playwright session running.

## File manager
Open Files & editor. Search filters saved flat filenames. Select a file, enter a new name and choose Rename or Duplicate. Operations check the source revision and never overwrite an existing destination; duplication copies the saved version, not unsaved editor text. Note files are managed through the Notes app. Directories and binary files remain planned.

Regression: `playwright-cli -s=arena run-code "$(cat tools/test/file_manager_browser.js)"` with the server and browser session running.
