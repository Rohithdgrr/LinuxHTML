# LinuxHTML OS — feature list

Status: product blueprint, not a claim that all features exist. Last updated 2026-11-02.

## Product and audience
A browser-hosted web desktop with optional Linux execution. Learners need guided safe practice, developers need reproducible tools, everyday users need understandable files and apps, and organizations need governance. The browser remains the host OS; this product cannot bypass browser permissions or provide unrestricted hardware access.

## Feature inventory
| Area | Features | Priority / status |
|---|---|---|
| Foundation | Maintained guest; integrity checks; boot, reset, failure states; durable workspace | P0 / partially implemented: experimental old guest, checks, reboot and local text workspace |
| Files | Folders, rename, copy, move, trash, import/export, previews, search, storage meter | P0–P1 / planned; local flat text search, rename, duplicate, save, delete, UTF-8 import/export and unencrypted JSON backup/restore implemented; folders and binary support planned |
| Guest exchange | Explicit copy to/from guest; conflict detection; eventually shared workspace | P0 / explicit text copy and revision-based local conflict detection implemented, no automatic sync |
| Desktop | Launcher, dock, windows, resize, snap, search, notifications, themes | P1 / desktop, dock, launcher, move/resize, minimize/maximize and local theme preference implemented; snap and other features planned |
| Apps | File manager, editor, terminal, settings, notes, calculator, PDF/image viewer | P1–P2 / terminal and text workspace windows; learning has three prototype exercises; local Notes and Calculator implemented; other apps planned |
| Developer tools | Project explorer, Git, language runtimes, package management, templates, debugging | P2 / two shell starters and editor handoff implemented; language runtimes, Git and full project workflows planned |
| Learning | Lesson catalog, instructions, exercises, hints, automated checks, reset, local progress | P2 / three beginner exercises, hints, checks and local progress implemented; full catalog and isolated resets planned |
| Accounts | Guest mode, optional account, settings, cross-device sync | P3 / planned |
| Education | Assignments, instructor dashboard, privacy-conscious progress | P3 / planned |
| Enterprise | SSO, RBAC, policy, audit, deployment, retention and admin console | P3 / planned; requires server services and security review |
| Accessibility | Keyboard operation, screen reader labels, contrast, reduced motion and localization | Cross-cutting / partial |
| Offline | Versioned local shell and assets, clear update status, offline lessons | P1 / basic service-worker caching exists; app installability not fully verified |
| Privacy/security | Explicit permissions, network opt-in, signed releases, backups, data deletion | P0+ / no external network relay configured, hashes unsigned, remaining planned |

## MVP acceptance
1. A maintained, license-documented guest boots to a usable console with no simulated-success status.
2. A local file can be created, edited, reopened after reload, copied to/from the guest, exported and deleted; errors are explicit.
3. Guest reset clearly states which data is erased; browser workspace survives unless explicitly deleted or browser data is cleared.
4. Supported browsers and offline limitations are documented and tested. Basic keyboard and screen-reader paths work.
5. Downloads are verified and release authenticity is addressed separately from hashes.

## Non-goals for MVP
Native OS replacement, arbitrary host-device access, production workload hosting, a complete desktop application catalog, automatic bidirectional filesystem synchronization and enterprise compliance certifications.
