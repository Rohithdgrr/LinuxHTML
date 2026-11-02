# Backend architecture

## Deployment models
**Local-first MVP:** a static web host delivers HTML, JS, CSS, VM assets and a service worker. No server-side user data or account is required. IndexedDB stores the current flat text workspace; the guest's 9P filesystem is a separate in-memory store. The optional Alpine guest has a separate browser-backed ext2 disk and an overlay shell entered after login; runtime mounts remain temporary and services boot outside the overlay. The emulator is a browser process, not a cloud VM.

**Optional self-hosted service (experimental):** `backend/server.py` provides a single-owner project-file API with an optional desktop project editor and manual local transfers; see [stage 1 documentation](self-hosted-backend.md). Identity, sync, remote execution, lesson catalog and organization administration are not implemented. A static host alone cannot supply server authorization, SSO, audit logging or cloud backup.

## Current components and ownership
- `src/ui/vm/index.html`, `app.css`, `app.js`: disclosure, VM controls, text workspace and explicit guest copy.
- `src/ui/vm/calculator.js`: local-only arithmetic parser; evaluates no JavaScript and does not contact the guest or a server. Results use floating-point arithmetic.
- `src/ui/vm/notes.js`: local notes saved as `lnote-<random>.txt` records in the same IndexedDB workspace. It uses atomic revision checks and appears in text backups; it has no separate account or sync service.
- `src/ui/vm/persistent-disk.js`: experimental 256 MiB Alpine ext2 data disk using IndexedDB block transactions and Web Locks, plus manual gzip export/restore. The overlay shell is not a fully installed boot root; see README.
- `src/ui/vm/checkpoints.js`: manual browser-local Buildroot emulator checkpoint in IndexedDB; unencrypted, quota-limited and not a backup. Alpine snapshots are disabled.
- `src/ui/vm/backup.js`: versioned, unencrypted JSON export/restore for saved local text files only. Validates input, caps file count and size, and restores in one transaction with no overwrites. No account or server is involved.
- `src/ui/vm/developer.js`: two shell-only starter templates. Opening a template transfers text to the editor; it does not save or execute it. The current guest has no included Python, Node or Git.
- `src/ui/vm/lessons.js`: three fixed lessons, unique per-attempt guest filenames and local completion flags. Checks read temporary v86 9P files; no lesson isolation or automatic guest cleanup.
- `src/ui/vm/workspace.js`: versioned IndexedDB database `linuxhtml-workspace`, `files` store, keyed by file name; each record contains name, text, update time and a unique revision. Transactions are awaited before reporting success.
- `backend/backup.py`: consistent online SQLite backup and guarded offline replacement restore for server projects only; unencrypted and manual.
- `tools/fetch_vm_assets.py`: fetches pinned demo dependencies and checks hashes.
- `tools/pack_vm.py`: verifies expected asset hashes and packages the app, unsigned manifest and cache worker. `tools/pack.py --tier base --target pwa` invokes it.
- `src/emulator/v86`: pinned source submodule for BIOS; v86 runtime is separately pinned to npm package 0.5.473. Their compatibility is demonstrated only for the tested demo guest.
- Browser service worker: caches same-origin packaged assets for offline use. Its cache is not a backup and has an independent lifecycle from IndexedDB.

## Storage contract
The local workspace stores UTF-8-style text strings under simple flat file names. Save compares the revision atomically and rejects unexpected overwrites; rename and duplicate atomically check the selected source revision and refuse an existing destination; load explicitly reads it; delete requires confirmation; export downloads the current text. A separate version-1 JSON backup exports all saved flat text files (maximum 500 files and 5 MiB); restore requires confirmation and uses an atomic add-only transaction, rejecting the whole batch on filename conflict. Backups are unencrypted and exclude unsaved text, guest files, settings and progress. Copy to `/mnt/<name>` and read from it are manual snapshots and do not save automatically. Guest reset destroys the guest copy but not IndexedDB. Data may be cleared or evicted by the browser; no durability or multi-device guarantees are made. Concurrent saves, renames, copies and deletes compare a unique revision in a single IndexedDB transaction; a changed or recreated record is rejected rather than silently overwritten. This does not merge changes or synchronize the UI across tabs. Quota, unsupported IndexedDB and transaction errors must be surfaced.

## Proposed interfaces
- Workspace service: list/read/write/delete/export with normalized paths, byte content, revisions, atomic writes and quota reporting. Add filesystem directories and binary files before general app integration.
- VM adapter: `start`, `stop`, `reset`, readiness and failure events, plus explicit guest file operations. No app should rely on emulator internals.
- Lesson engine: versioned lesson manifests, deterministic initial state, isolated reset, result checks with bounded execution and local progress.
- Future multi-user sync: add accounts, per-user authorization and quotas, secure sessions, conflict-aware client sync, retention and auditing. The experimental single-owner project API is not a sync service.

## Security boundaries
Same-origin app scripts can access same-origin workspace data. Browser sandbox and emulator are defense in depth, not a security guarantee. The current unsigned manifest detects accidental corruption but cannot protect against malicious replacement of the manifest and app. Authenticity requires a separate trusted signing/release design. Do not claim zero trust, encryption, isolation certification or regulatory compliance without independent validation.

## Operations
Use HTTPS in production; local HTTP is development only. COOP/COEP require a host that actually emits headers and a compatible asset policy. GitHub Pages does not honor `_headers`; do not advertise cross-origin isolation there. Keep dependency hashes, provenance, licenses and security updates under review; monitor storage failures and service-worker upgrades without collecting sensitive file content.
