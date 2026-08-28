# FEATURES.md - LinuxHTML Feature Catalogue

> **Source of Truth:** `README-1.md` is canonical. Derived from `README-1.md:1`, `README-1.md:7`, `README-1.md:10`, `README-1.md:11`, `README-1.md:12`, `README-1.md:20`, `README-1.md:26`, `README-1.md:28`.

## 1. Core Features

### 1.1 Browser-Based Linux Sandbox

*   Real Linux 6.6 LTS kernel + Alpine 3.19 userspace inside v86 x86_64 emulator compiled to WebAssembly, hosted entirely client-side in browser tab (`README-1.md:5`). No required server VM or SSH cloud connection (`README-1.md:118`).
*   Single-user, one VM per tab, x86_64 only, Linux only (`README-1.md:122`).

### 1.2 Hybrid Root/Disk Architecture (Flagship)

*   **Immutable read-only Alpine root** served through v86 9P filesystem (`README-1.md:16`).
*   **Separate writable virtual block disk** (`hda` raw image) for `/home`, `/root`, `/opt` (`README-1.md:18`, `README-1.md:362`).
*   Benefits: small immutable base, fast startup potential, no writable 9P needed, conventional block semantics, clean separation (`README-1.md:374`).

### 1.3 Reproducible Builds

*   Exact dependency pinning in `versions.lock` (`README-1.md:1474`), Docker Alpine rootfs, pinned Emscripten via emsdk, SHA verification (`README-1.md:6`).

### 1.4 Integrity Verification

*   SHA-256 verification of WASM, kernel, Alpine root, BIOS, writable-disk seed before boot via Web Crypto (`README-1.md:1486`, `README-1.md:1501`). Boot blocked until success (`README-1.md:1342`). Release `manifest.json` + `.sig` signed (`README-1.md:1522`).

## 2. Storage Features

*   **Hybrid persistence:** Immutable 9P root + writable hda (`README-1.md:344`).
*   **Backend hierarchy:** OPFS primary → IndexedDB fallback → in-memory last resort with non-dismissible warning (`README-1.md:889`, `README-1.md:910`).
*   **Dedicated storage Worker:** Single Worker owns handle, serializes all persistent disk I/O (`README-1.md:917`).
*   **Disk API:** `open/read/write/flush/truncate/size/export/import/close` (`README-1.md:939`) with bounds validation, quota handling, atomic write policy `write temp → flush → rename` (`README-1.md:1028`).
*   **Backup:** Local export/import `.img` only, no cloud sync v1 (`README-1.md:1052`). No `localStorage`/`sessionStorage` (`README-1.md:1064`).
*   **Optional encryption:** Web Crypto AES-GCM, off by default, no plaintext keys in storage (`README-1.md:1040`).

## 3. Display & Input Features

*   **Display:** Canvas2D default with dirty-rectangle optimization (`README-1.md:1193`); optional experimental WebGL2 via `?gpu=1` (`README-1.md:1212`) - not GPU passthrough.
*   **Input:** DOM keyboard, mouse, touch → PS/2/device emulation (`README-1.md:1221`); touch includes basic on-screen trackpad (`README-1.md:1236`), functional but not polished v1 (`README-1.md:1238`).
*   **Resolution:** 1024x768 target, tier-configurable (`README-1.md:1242`).

## 4. Networking Features

*   **HTTP/HTTPS egress bridge** (opt-in, OFF by default `README-1.md:1174`): Guest TCP terminated by `network.js` SLIRP-style translation → browser `fetch()` (`README-1.md:1098`). Guest believes normal TCP.
*   **Supported:** HTTP, HTTPS, browser-compatible methods, DNS via bridge resolver (`README-1.md:1128`).
*   **Explicitly unsupported:** raw TCP passthrough, raw UDP, ICMP/ping, arbitrary sockets, SSH raw, WebSocket relay, WebRTC P2P, server-side relay (`README-1.md:1136`). Unsupported protocols fail cleanly with visible error (`README-1.md:1687`).
*   **CORS enforcement:** No bypass (`README-1.md:1159`); endpoint rejecting browser origin is expected unreachable.

## 5. Deployment Features

*   **PWA (primary):** `index.html` + `assets/` + `sw.js` + `manifest.webmanifest` (`README-1.md:414`), static hosting with COOP/COEP for SMP (`README-1.md:778`), service worker versioned cache, visible "Update available", no silent reload (`README-1.md:815`).
*   **Single-file (secondary):** `build/linuxhtml.html` base64-embedded HTML for offline/demo (`README-1.md:788`), ~33% overhead (`README-1.md:797`), manual updates, single-core due to `file://` isolation limit (`README-1.md:808`).
*   **SMP:** PWA+COOP/COEP supported where permitted; single-file/Safari no (`README-1.md:803`).

## 6. Build Tier Features

| Tier | Cap | RAM | Packages |
|------|-----|-----|----------|
| micro | 8MB | 128MB | BusyBox only, no pkg manager |
| base | 15MB | 256MB | + gcc + git + python3 + vim (DevBox validation `README-1.md:2421`) |
| standard | 25MB | 512MB | base + Node.js + additional langs |

Node.js Standard-only (`README-1.md:671`). Size budget >5% over fails CI (`README-1.md:677`).

## 7. Developer Experience Features

*   **Canonical one-shot build:** `./build.sh --tier base --target pwa --verify` (`README-1.md:652`).
*   **Staged build:** Kernel → initramfs → QEMU gates → rootfs → QEMU real → WASM → pack → verify (`README-1.md:494`) for isolated failure diagnosis.
*   **Native QEMU validation:** Both minimal and real root must boot natively before browser (`README-1.md:538`, `README-1.md:600`).
*   **Extension API:** Downstream via `examples/<project>/profile.json` + `overlay/` (`README-1.md:2143`), not forking `src/` (`README-1.md:2164`); profile defines tier, overlay, boot args, UI branding (`README-1.md:2156`).
*   **Performance instrumentation:** Boot waterfall `performance.mark/measure` throughout (`README-1.md:1861`).

## 8. Security Features

*   **Defense-in-depth:** Browser/WASM sandbox + integrity + pinning + network off by default (`README-1.md:1379`); not claimed escape-proof or formally verified (`README-1.md:1378`).
*   **First-run disclosure:** Non-bypassable screen explaining WASM arbitrary code execution, trust source only (`README-1.md:745`).
*   **Default credentials:** `root` no password for local dev only; network/distributed builds must harden (`README-1.md:1425`).
*   **Supply chain:** Exact pinning + SBOM (`README-1.md:1474`), security-sensitive changes require second maintainer review (`README-1.md:1482`).

## 9. Testing Features

Divided layers (`README-1.md:1555`):

*   Native kernel boot (QEMU + minimal initramfs)
*   Real root boot (QEMU + Alpine + hda)
*   Browser boot smoke (`test_boot.py` → headless Chromium → login prompt + timing)
*   Storage round-trip (`test_storage.py` → write/flush/read, quota exhaustion, export/import)
*   Disk API tests (all 9 ops + invalid offsets/lengths/closed handles/backend failures)
*   Network bridge (`test_network.py` → curl HTTP success + non-HTTP clean fail)
*   Cross-browser (`test_cross_browser.py` → Chromium/Firefox/WebKit capability-dependent)
*   Fuzzing (VirtIO block, VGA, UART `README-1.md:1712`, nightly, not exhaustive `README-1.md:1721`)

## 10. Non-Features / Known Limitations (`README-1.md:1938`)

v1 explicitly **not**:
*   GPU compute/passthrough, WebGPU virtio-gpu, multi-VM orchestration, multi-tenant, raw TCP/UDP/ICMP, general SSH transport, HTTP/HTTPS only for egress, CORS-bypass, network off by default, Safari SMP unsupported, single-file single-core, fuzz not exhaustive, targets not measured facts, no production security audit yet, no cloud sync, no writable 9P root, Linux guest only, Windows/macOS guest unsupported, RISC-V not in v1.

## 11. Roadmap Features (Post-v1 `README-1.md:2520`)

Only after v1 validated; potential (no committed timeline):
*   WebSocket relay, WebRTC networking, WebGPU research, multi-VM orchestration, additional profiles, RISC-V/TinyEMU, improved mobile input, stronger encryption, richer tooling.

## 12. Final Project Description Feature Summary (`README-1.md:2842`)

*Browser-based Linux dev sandbox running real Linux 6.6 + Alpine 3.19 inside v86 WASM, immutable 9P Alpine root + separate writable hda disk backed by OPFS via dedicated Worker, browser display/input, optional HTTP/HTTPS egress, reproducible builds, integrity verification, automated testing, PWA + offline single-file.*

## 13. References

*   `README-1.md:1` What This Is
*   `README-1.md:5` Directory Structure
*   `README-1.md:10` Storage Model
*   `README-1.md:20` Known Limitations
*   `README-1.md:22` Extension API
*   `README-1.md:26` Roadmap
