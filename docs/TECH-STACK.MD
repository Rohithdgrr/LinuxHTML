# TECH-STACK.md - LinuxHTML Technology Stack

> **Source of Truth:** `README-1.md` is canonical. Derived from `README-1.md:3`, `README-1.md:4`, `README-1.md:10`, `README-1.md:11`, `README-1.md:12`, `README-1.md:14`, `README-1.md:19`.

## 1. Core Stack

| Layer | Technology | Version / Pin | Purpose | Reference |
|-------|------------|---------------|---------|-----------|
| **Guest Kernel** | Linux | 6.6 LTS (exact .x in `versions.lock`) | Boot inside v86, provides POSIX, TCP/IP, VirtIO drivers | `README-1.md:103` |
| **Guest Userspace** | Alpine Linux | 3.19 (digest pinned in `versions.lock`) | Immutable root filesystem, musl + BusyBox base | `README-1.md:104` |
| **Emulator** | v86 | Pinned git submodule commit | x86_64 CPU + VirtIO block/9P/net + BIOS/VGA emulation | `README-1.md:105` |
| **Execution** | WebAssembly | via Emscripten (exact version in `versions.lock`) | Compiles v86 to run in browser | `README-1.md:106` |
| **Host** | Browser | Chrome/Edge 120+, Firefox 122+, Safari 17+ | Provides WASM, Canvas, input, storage, networking, Crypto | `README-1.md:284` |
| **Build OS** | Linux x86_64 | - | Kernel cross-compile + Docker rootfs build | `README-1.md:248` |

Derived: `README-1.md:5` precisely: Linux 6.6 + Alpine 3.19 inside v86 compiled to WASM client-side.

## 2. Build Toolchain

| Tool | Version | Purpose |
|------|---------|---------|
| Docker | 24.x+ | Reproducible Alpine rootfs build (`README-1.md:254`) |
| Python | 3.10+ | Build orchestration + tests (`README-1.md:257`) |
| QEMU | Recent `qemu-system-x86_64` | Mandatory native kernel/rootfs boot checks (`README-1.md:260`) |
| Emscripten | Exact `versions.lock` via emsdk | v86 WASM compilation; do not use system-wide (`README-1.md:264`) |
| Node.js | 20.x LTS | Build tooling/esbuild (`README-1.md:267`) |
| esbuild | (via Node) | Frontend bundling |
| RAM/Disk | 8GB+ / 10GB+ free | Kernel, Docker, WASM builds (`README-1.md:269`) |

Build orchestration: `build.sh`, `Makefile`, `src/kernel/build.sh`, `src/rootfs/build.sh`, `src/emulator/build.sh`, `tools/pack.py`, `tools/verify_versions.py` (`README-1.md:412`).

**Prerequisites note:** macOS/WSL2 not supported for v1 unless added to matrix later (`README-1.md:276`).

## 3. Frontend / Browser Stack

| Component | Technology | Details |
|-----------|------------|---------|
| **Language** | JavaScript (ES modules) | `src/main.js` orchestration, `src/bridge/*.js` |
| **Display** | Canvas2D (default) | 1024x768, dirty-rectangle updates (`README-1.md:1193`) |
| **Display Experimental** | WebGL2 | Feature flag `?gpu=1`, not GPU passthrough (`README-1.md:1212`) |
| **Input** | DOM APIs | Keyboard/Mouse/Touch → `input.js` → PS/2 (`README-1.md:1221`) |
| **Storage Primary** | OPFS (Origin Private File System) | Sync access handles, via dedicated Worker (`README-1.md:889`) |
| **Storage Fallback** | IndexedDB | When OPFS unavailable (`README-1.md:901`) |
| **Storage Last Resort** | In-memory | Non-dismissible warning, data lost on close (`README-1.md:910`) |
| **Worker** | Dedicated Web Worker | Owns disk handle, serializes I/O (`README-1.md:917`) |
| **Integrity** | Web Crypto API | `crypto.subtle.digest("SHA-256", buffer)` (`README-1.md:1501`) |
| **Networking Bridge** | Fetch API | Guest TCP terminated → `fetch()` → browser stack (`README-1.md:1102`) |
| **Packaging** | PWA + Single-file | PWA with service worker + manifest; single-file base64-embedded HTML (`README-1.md:760`) |
| **Hosting Headers** | COOP/COEP | `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` for SharedArrayBuffer/SMP (`README-1.md:198`) |
| **Service Worker** | `sw.js` | Versioned cache, visible update, no silent reload (`README-1.md:815`) |
| **Performance** | `performance.mark/measure` | Boot waterfall instrumentation (`README-1.md:1861`) |

**Not Used:** `localStorage`/`sessionStorage` prohibited for persistence (`README-1.md:1064`), `tinyemu`/RISC-V not in v1 (`README-1.md:488`).

## 4. Guest Stack

| Component | Technology | Tier Availability |
|-----------|------------|-------------------|
| **C Library** | musl | all tiers |
| **Core Utils** | BusyBox | micro+ |
| **Compiler** | gcc | base+, not micro |
| **VCS** | git | base+ |
| **Language** | python3 | base+ |
| **Editor** | vim | base+ |
| **Runtime** | Node.js | standard only (`DO NOT assume in base` `README-1.md:671`) |

Sizes: micro 8MB/128MB RAM, base 15MB/256MB, standard 25MB/512MB (`README-1.md:664`).

## 5. Storage Stack Detail

```
Linux block device → v86 hda (raw .img: /home /root /opt) → storage.js → Worker → OPFS (primary) → IndexedDB → memory
```
Immutale SquashFS path: `Alpine SquashFS → filesystem.baseurl → VirtIO 9P → host9p` (`README-1.md:844`).

Encryption optional: Web Crypto AES-GCM, off by default, no plaintext keys in storage (`README-1.md:1042`).

## 6. Network Stack Detail

```
Guest POSIX socket() → Linux TCP/IP stack → VirtIO-net → v86 → network.js (SLIRP-style, terminates TCP, extracts HTTP, issues fetch) → Browser network stack
```
Supports: HTTP/HTTPS, DNS via bridge resolver. Explicitly no raw TCP/UDP, ICMP/ping, SSH raw, WebSocket relay, WebRTC P2P, server relay (`README-1.md:1136`). CORS enforced, no bypass (`README-1.md:1159`). Default OFF (`README-1.md:1174`).

## 7. Verification & Supply Chain Stack

*   **Integrity:** SHA-256 via Web Crypto, `build/manifest.json` + `manifest.json.sig` signed with release key (`README-1.md:1522`).
*   **Pinning:** Every dependency pinned in `versions.lock` (`README-1.md:1474`), verified by `tools/verify_versions.py`.
*   **SBOM:** Generated for rootfs (`README-1.md:1480`).
*   **Testing:** `pytest` + headless Chromium/Firefox/WebKit (`tools/test/test_boot.py`, `test_storage.py`, `test_network.py`, `test_cross_browser.py`, `fuzz/` `README-1.md:462`).

## 8. Browser Compatibility Stack

| Browser | Storage | SMP | Notes |
|---------|---------|-----|-------|
| Chrome/Edge 120+ | OPFS | Yes (PWA+COOP/COEP) | Reference (`README-1.md:1906`) |
| Firefox 122+ | OPFS or IndexedDB | Capability-dependent | Cross-browser nightly |
| Safari macOS 17+ | IndexedDB fallback | No | OPFS sync varies |
| Safari iOS | IndexedDB | No | Tighter memory |
| Chrome Android | OPFS where available | Device-dependent | ≤15s target |

Capability-based detection: SharedArrayBuffer, cross-origin isolation, OPFS, sync handles, memory limits (`README-1.md:1926`).

## 9. DevOps Stack

*   **Serve:** `tools/serve.py` (not `python -m http.server` `README-1.md:728`) provides COOP/COEP.
*   **Pack:** `tools/pack.py --tier {micro,base,standard} --target {pwa,single-file}`.
*   **CI/CD:** Tiered - PR (core + Chromium), Nightly (Firefox/WebKit + fuzz), Release (all + benchmarks + signing) (`README-1.md:1726`).
*   **Benchmark:** `tools/bench/` + `docs/BENCHMARKS.md`.

## 10. Conceptual Reference

*   LinuxPDF by ading2210 (constrained document env precedent) (`README-1.md:28`, `README-1.md:2738`).
*   v86 included as pinned submodule (2-clause BSD).

## 11. Stack Invariants

*   No GPU compute stack in v1 (`WORKING.md`)
*   Single-user, one VM per tab, x86_64 only, Linux only, offline-first (`README-1.md:122`).
*   All numbers targets until measured in `docs/BENCHMARKS.md` (`README-1.md:33`).

## 12. References

*   `README-1.md:3` Prerequisites
*   `README-1.md:4` Architecture Overview
*   `README-1.md:7` Build Tiers
*   `README-1.md:10` Storage Model
*   `README-1.md:13` v86 Configuration
*   `README-1.md:19` Browser Compatibility Matrix
