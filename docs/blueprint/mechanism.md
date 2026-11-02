# System mechanism

## Current runtime path
1. The static host serves the app. The service worker may cache the shell and packaged assets after installation.
2. User acknowledges the disclosure. `app.js` fetches the manifest and required same-origin artifacts, hashes the bytes and rejects mismatches. The unsigned manifest is not an authenticity guarantee.
3. Verified JavaScript and WASM bytes are supplied to v86; BIOS and bzImage are passed as buffers. v86 boots the experimental upstream Buildroot Linux 6.8.12 i686 image in browser memory.
4. A display mutation observer looks for this image's `~%` prompt. This is an imperfect, image-specific readiness heuristic, not a general guest-health protocol.
5. The guest exposes an in-memory 9P filesystem at `/mnt`. A text file can be explicitly copied in or read back through v86 APIs.
6. Separately, `workspace.js` stores flat text records in IndexedDB. Save/load/delete are transactional; the transaction must complete before success is displayed. No automatic sync runs between the two stores.
7. The learning app checks generated temporary guest files against fixed expected text and stores completion flags in browser local storage. New attempt changes its filename and clears completion; old guest files are not deleted.
8. Dev Studio sends a selected single-file shell template to the local text editor only after confirmation if unsaved content would be replaced. Saving, copying to the guest and running are separate user actions.
9. The backup app downloads a versioned JSON copy of saved local text files. Restore validates limits and filenames, requests confirmation and adds all files atomically; any existing name aborts the batch. It excludes guest data, unsaved edits, settings and progress, and is not encrypted.
10. Notes are normal local text records, with first non-empty line used as a display title. Save and delete compare record revisions; search filters local note text. Notes are included in the unencrypted workspace backup.
11. Restart reloads the page and loses temporary guest state; saved IndexedDB records remain unless browser data is cleared or evicted. Export provides an individual text download.

## Planned target flow
Web apps call a workspace API rather than reaching directly into the emulator. That service owns persistent files, normalized paths, revisions and conflict rules. A VM adapter controls lifecycle and bridges explicitly chosen files to guest storage. A lesson engine provisions a disposable workspace, runs bounded checks and stores progress separately. Optional server sync sits behind authentication and never becomes a prerequisite for local-only use.

## Trust and data boundaries
User/browser ↔ web app ↔ IndexedDB; web app ↔ emulator ↔ guest; optional app ↔ server. Treat guest content and filenames as untrusted. Validate paths and sizes, handle errors without claiming success, and keep permissions explicit. All same-origin scripts have significant access, so dependencies and XSS prevention are important. A manifest downloaded from the same origin as its assets does not by itself prevent malicious replacement.

## Failure behavior
Missing/mismatched artifact blocks startup; local workspace errors are reported; guest copy errors are reported; browser eviction and user clearing can remove saved data. The current startup does not yet have a complete timeout or VM error lifecycle. Avoid data-loss claims until fault and recovery tests are in place.

The xterm.js serial terminal offers shell history and control keys. Browser resizing does not synchronize guest PTY dimensions; full-screen apps can be incorrectly sized. Native keyboard paste does not have the multiline warning provided by the Paste button.
