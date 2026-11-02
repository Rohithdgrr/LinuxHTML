# LinuxHTML implementation roadmap

Status: staged plan, not a claim that future features are complete. The published Pages build is an experimental Buildroot guest with temporary guest storage. A separate Alpine build has an experimental browser-backed overlay shell; it is not a fully installed boot root. The self-hosted project API is experimental.

## 1. Reliability and device usability — in progress
- [x] Mobile-sized app panels, touch controls and terminal command input; Chromium mobile viewport end-to-end test.
- [x] Run current Buildroot packaging, backend, and desktop/mobile Chromium workflows in PR CI; the first verified passing run is https://github.com/Rohithdgrr/LinuxHTML/actions/runs/41484553270.
- [ ] Test physical Android and iOS devices and desktop Chrome, Firefox and Safari; publish the actual support matrix.
- [x] Make app-update availability and storage state visible without automatically reloading or destroying work; verified with a real waiting service worker in Chromium.
- [x] Show Linux asset-loading progress and recoverable download/integrity errors; test a failed mobile startup and retry.
- [ ] Continue failure and recovery testing for offline, full quota, blocked storage, orientation and keyboard scenarios.
- Acceptance: documented end-to-end results for terminal, notes, files, lessons and editor on supported devices; failures surface actionable messages.

## 2. Editing and desktop
- Prototype lazily loaded CodeMirror 6 with plain-text fallback; compare Monaco with measured load, memory, accessibility and touch behavior. A language service or VS Code extension ecosystem is not implied.
- [x] Add literal find/replace and find/save shortcuts to the current text editor, with confirmation and unsaved-change protection.
- [ ] Improve desktop session restoration.
- Evaluate OS.js or another window manager only if maintenance or capability gaps justify migration. Review licenses, mobile behavior and offline packaging before adoption.

## 3. Files and recovery
- Clarify browser workspace, guest storage and self-hosted projects as separate boundaries; improve transfer, backups, quota and restore guidance.
- Harden and test Alpine persistent overlay, failure handling, version migration and recovery before making it default. Browser eviction, unencrypted backups and ext2 damage remain risks.
- Evaluate ZenFS/Filer only for a demonstrated browser-workspace need; a browser filesystem does not automatically persist guest files. BrowserFS is deprecated: https://github.com/browser-fs/NOTICE

## 4. Terminal evaluation
- Prototype ghostty-web behind a feature flag; compare xterm behavior, selection, IME, Unicode, accessibility, resize, mobile, WASM and offline loading. Confirm actual API/addon compatibility before switching: https://github.com/coder/ghostty-web

## 5. Controlled networking and packages
- Design authenticated, restricted relay and threat model; test policy enforcement, abuse limits and recovery. Then test Alpine package installation and persistence. A GUI alone cannot add networking or package management.

## 6. Self-hosted platform
- Add proper accounts and authorization, TLS/deployment guidance, resource limits, backup/restore drills, monitoring and security review. Consider sync and remote execution only after isolation and access controls.

## 7. Optional integrations
- Add audio, graphics, push and performance research only for measured needs. Background web push requires permission, service worker and push infrastructure; platform support varies. Profile alternative execution approaches rather than assuming they replace v86.

All stages require license and dependency review, pinned artifacts, upgrade and rollback paths, and honest limitations. No dates or universal-device support are promised.

CI coverage is limited to the implemented Buildroot preview and backend; it does not validate Alpine VM persistence, cross-browser support, security, QEMU, networking or planned rootfs builds. The historical nightly/release workflows have not yet been modernized.
