# Implementation tasks

Legend: [x] implemented and verified to the stated extent; [~] started; [ ] not completed. Evidence refers to the current local checkout, not the published site.

## Phase 1 — foundation
- [x] Pinned demo assets and reproducible fetch/package (`tools/fetch_vm_assets.py`, `tools/pack_vm.py`). Runtime hashes checked against an unsigned manifest; authenticity not solved.
- [x] Real v86 boot of upstream Buildroot Linux 6.8.12 demo and guest console. Chromium smoke test ran `uname -a`; this guest is obsolete.
- [x] Local flat text workspace: IndexedDB save, list, open, delete and UTF-8 text import/export (`src/ui/vm/workspace.js`, `app.js`).
- [x] Explicit text copy into and read from temporary `/mnt`; not continuous sync. Chromium tested copy into and read back from the guest.
- [x] Confirmed local save survives reload and confirmed deletion in Chromium; packaging regression tests pass.
- [~] Reset: reload restarts guest after a confirmation warning; needs distinct lesson/reset controls, error handling and broader tests.
- [~] Offline: previous Chromium check booted after cache installation; repeat for updated workspace and other browsers.
- [ ] Replace obsolete demo with a maintained, reproducibly built and license-reviewed guest; boot-test it.
- [ ] Define release authenticity, signature trust root and key rotation; implement and test.
- [ ] Robust VM readiness/error/timeout and teardown; a 60-second warning exists, but replace prompt text heuristic.
- [x] Atomic local save/delete revision checks prevent stale cross-tab overwrite and delete, including delete/recreate; Chromium browser regression added.
- [ ] Test IndexedDB unavailable, storage quota, private mode, eviction and migrations across browsers.
- [ ] Add binary files, directories, safe path normalization, conflict resolution UI and full backup/restore; current backup supports only saved flat text files, max 500 files and 5 MiB. Individual text imports remain limited to 1 MiB.
- [ ] Automate the manual Chromium guest round-trip and deletion tests; add export and long-running regression suite.
- [ ] Accessibility audit, keyboard flows, responsive testing and browser compatibility matrix.
- [ ] Pin and review licenses for all distributed guest artifacts; update security and operational docs.
- [ ] Host capable of configured COOP/COEP if needed; confirm all resources satisfy policy.

## Phase 2 — desktop
- [~] Desktop home, wallpaper, launcher, dock, movable/resizable windows, minimize, maximize/restore and local theme persistence implemented. Chromium desktop and mobile checks passed; full accessibility and browser matrix remain.
- [~] Flat text file manager supports name search, revision-checked atomic rename/duplicate, edit, import/export and deletion. A hierarchical/binary file manager and accessibility audit remain; titlebar and resize controls support arrow keys.
- [x] Experimental guest terminal integrated into desktop with explicit disclosure; Chromium boot and copy-to-guest smoke test passed. Maintained guest still required.

## Phase 3 — learning
- [~] Three beginner exercises with examples, hints and guest-file checks implemented and tested in Chromium. A versioned lesson manifest, bounded checks and ten-lesson curriculum remain.
- [~] Local progress, hints and new-attempt action implemented. New attempts use a unique filename and clear lesson progress but do not delete previous guest files; true isolated lesson environments and offline browser coverage remain.

## Phase 4 — developer workspace
- [~] Dev Studio offers two single-file shell starters and opens them in the local editor without automatically saving or overwriting; Chromium test covers guest execution, reload and unsaved-change cancellation. Not a multi-file project manager.
- [~] Existing text workspace can save and explicitly copy scripts to `/mnt`. Unsaved changes prompt before opening a different file, importing, reading from the guest or loading a template.
- [ ] Maintained guest with supported Python, Node, Git and a reproducible toolchain; do not represent these as available in the demo image.
- [ ] Directories, project explorer, multi-file projects, version control, dependency management, testing and debugging workflows.

## Phase 5 — data portability and future accounts
- [x] Export versioned local text-workspace JSON and restore new files atomically without overwriting; validated with Chromium conflict rollback, invalid input and restore checks. Backup is unencrypted and excludes guest files, unsaved edits, preferences and lesson progress.
- [~] Initial offline check opens Backups after cache installation in Chromium; test actual downloads/restores offline and other browsers.
- [ ] Encrypted/full backups, binary files, directories, migrations and recovery tooling.
- [ ] Optional accounts/sync; teacher features; enterprise policy and audit require backend, threat and privacy reviews. No accounts, sync, SSO or enterprise security controls implemented.
