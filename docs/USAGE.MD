# USAGE.md - How to Use LinuxHTML

> **Source of Truth:** `README-1.md` is canonical. Derived from `README-1.md:2`, `README-1.md:3`, `README-1.md:8`, `README-1.md:9`, `README-1.md:11`, `README-1.md:21`, `README-1.md:22`.

## 1. Quick Start - Canonical Workflow

Exactly one canonical build workflow (`README-1.md:172`):

```bash
git clone https://github.com/<org>/linuxhtml.git
cd linuxhtml

python3 -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt

./build.sh --tier base --target pwa --verify
python3 tools/serve.py
```

Open printed URL, default:

```
http://localhost:8080
```
`README-1.md:192`.

**Important:** For PWA, use `tools/serve.py` not bare `python -m http.server`. It sets required headers (`README-1.md:198`):

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Required for cross-origin-isolated environment used by SharedArrayBuffer/SMP (`README-1.md:204`).

## 2. Prerequisites

### 2.1 Build Machine (`README-1.md:244`)

| Requirement | Version | Purpose |
|-------------|---------|---------|
| OS | Linux x86_64 | Kernel cross-compile + Docker rootfs |
| Docker | 24.x+ | Reproducible Alpine rootfs |
| Python | 3.10+ | Build orchestration/tests |
| QEMU | Recent `qemu-system-x86_64` | Native boot checks (mandatory) |
| Emscripten | Exact `versions.lock` | v86 WASM compilation |
| Node.js | 20.x LTS | Build tooling/esbuild |
| RAM | 8GB+ | Kernel/Docker/WASM |
| Disk | 10GB+ free | Sources/layers/artifacts |

macOS/WSL2 not supported v1 unless added to matrix (`README-1.md:276`). No RISC-V toolchain, no GPU needed.

### 2.2 Browser (`README-1.md:284`)

*   Chrome/Edge 120+ (reference)
*   Firefox 122+
*   Safari 17+ (reduced capabilities)
*   Current Android Chrome for mobile validation

Capability-based, not UA-only (`README-1.md:292`).

## 3. Expected First-Run Flow (`README-1.md:206`)

```
Browser page → Capability probe → Integrity verification → First-run disclosure → v86 initialization → Linux boot → Login prompt
```

*   Desktop boot target ≤8s (not guaranteed until `docs/BENCHMARKS.md` `README-1.md:224`).
*   Dev credentials: `root` no password (`README-1.md:230`) - do not expose network-enabled build with defaults outside controlled machine (`README-1.md:235`).

First-run disclosure explains WASM executes arbitrary code, trust source only, cannot be bypassed by query param/flag/hidden UI/alt path (`README-1.md:745`).

## 4. Running Locally

```bash
python3 tools/serve.py
```
Do not use bare static server for PWA (`README-1.md:728`). Dev server supplies COOP/COEP (`README-1.md:732`). Single-file can be opened as local file but no SMP (`README-1.md:741`).

## 5. Deployment Usage

### 5.1 PWA - Primary (`README-1.md:761`)

```
index.html → assets/{v86.wasm, kernel, rootfs, BIOS} → service worker
```

Requirements: static hosting with header control + COOP/COEP for SMP.

Updates: service-worker cache versioned, shows "Update available", no silent reload (`README-1.md:815`).

### 5.2 Single-File - Secondary (`README-1.md:788`)

```bash
python3 tools/pack.py --tier base --target single-file
# → build/linuxhtml.html (~33% base64 overhead)
```

Offline/demo distribution, manual replacement updates (`README-1.md:822`), single-core due to `file://` no isolation (`README-1.md:808`).

### 5.3 SMP (`README-1.md:803`)

*   PWA+COOP/COEP: Supported where permitted
*   Single-file `file://`: No (browser constraint, not bug `README-1.md:811`)
*   Safari/WebKit: Unsupported v1

## 6. Storage Usage

**Persistent paths on writable hda disk:** `/home`, `/root`, `/opt` (`README-1.md:589`). Alpine root is immutable read-only via 9P (`README-1.md:834`).

**Export/Import:**

```
Settings → Export disk → .img download
Settings → Import disk ← .img (validates type/version/size/integrity)
```
`README-1.md:1052`.

Architecture is OPFS primary → IndexedDB fallback → memory last resort (persistent warning, data lost on close `README-1.md:910`). No `localStorage`/`sessionStorage` (`README-1.md:1064`).

**Encryption at rest (opt-in):** Web Crypto AES-GCM, off by default, no plaintext keys in storage (`README-1.md:1040`).

## 7. Networking Usage

Default **OFF** (`README-1.md:1174`). UI must clearly show when enabled.

When enabled, v1 provides **HTTP/HTTPS egress bridge** only (`README-1.md:1073`), not general internet:

*   Works: HTTP/HTTPS, browser-compatible methods, DNS via bridge resolver (`README-1.md:1128`).
*   Fails cleanly (expected): raw TCP passthrough, raw UDP, ICMP/ping, arbitrary socket forwarding, SSH raw transport, WebSocket relay, WebRTC P2P, server-side relay (`README-1.md:1136`).
*   Guest creates TCP socket but only HTTP/HTTPS translated (`README-1.md:1150`).
*   Subject to browser CORS, no bypass (`README-1.md:1153`). Endpoint rejecting browser origin is expected unreachable.
*   Do not ship public network-enabled build with root/no-password (`README-1.md:1185`).

## 8. Display & Input Usage

*   Default Canvas2D with dirty-rect updates (`README-1.md:1193`); optional WebGL2 experimental via `?gpu=1` (`README-1.md:1214`), not GPU passthrough.
*   Input: DOM keyboard/mouse/touch → PS/2 (`README-1.md:1221`); touch includes basic on-screen trackpad (functional, not polished `README-1.md:1238`).
*   Resolution: 1024x768 target, tier-configurable (`README-1.md:1242`).

## 9. Build Tiers Usage (`README-1.md:664`)

| Tier | Cap | RAM | Use When |
|------|-----|-----|----------|
| micro | 8MB | 128MB | BusyBox-only, minimal |
| base | 15MB | 256MB | Dev: gcc git python3 vim |
| standard | 25MB | 512MB | Need Node.js + additional langs |

Node.js is Standard-only, do not assume in Base (`README-1.md:671`). Size budget >5% over fails CI (`README-1.md:677`).

Build commands:

```bash
cd src/rootfs && ./build.sh --tier base   # → build/rootfs-base.squashfs
python3 tools/pack.py --tier base --target pwa
```

## 10. Verification Usage (`README-1.md:642`)

```bash
python3 tools/verify_versions.py
python3 -m pytest tools/test/
# Individual:
pytest tools/test/test_boot.py        # headless Chromium, assert login prompt
pytest tools/test/test_storage.py     # write/flush/read, quota, export/import
pytest tools/test/test_network.py     # curl via bridge, non-HTTP clean fail
pytest tools/test/test_cross_browser.py # Chromium/Firefox/WebKit
```

Integrity verification before boot uses Web Crypto SHA-256 (`README-1.md:1501`); tamper (modify one byte) → boot rejected (`README-1.md:1540`). Release `build/manifest.json` + `.sig` (`README-1.md:1522`).

## 11. Extension Usage (`README-1.md:2138`)

Downstream projects extend via profiles, not forking `src/` (`README-1.md:2164`):

```bash
examples/<your-project>/{profile.json, overlay/}
```

Example profile (`README-1.md:2187`):

```json
{
  "name": "devbox",
  "tier": "base",
  "rootfs_overlay": "overlay/",
  "boot_args": ["root=host9p","rootfstype=9p","rootflags=trans=virtio"],
  "ui": { "terminal_theme": "default" }
}
```

Schema in `docs/API.md` (`README-1.md:2206`). For missing bridge capability, propose upstream rather than downstream workaround (`README-1.md:2181`).

## 12. Troubleshooting Quick Reference (`README-1.md:1966`)

*   **Blank page / no splash:** PWA without COOP/COEP → `python3 tools/serve.py` (`README-1.md:1972`).
*   **`SharedArrayBuffer is not defined`:** COOP/COEP missing → verify headers (`README-1.md:1985`).
*   **Boot freeze after verify:** DevTools console → check fetch/CORS/hash/manifest/WASM (`README-1.md:2001`).
*   **QEMU minimal boot fails:** Check `linuxhtml_defconfig`/kernel/minimal initramfs, do not debug v86 (`README-1.md:2012`).
*   **Real root boot fails but minimal succeeds:** Investigate Alpine rootfs, 9P config, boot args, writable disk (`README-1.md:2024`).
*   **Writable disk missing:** Check hda config, disk creation, Worker, OPFS, geometry, mount logs (`README-1.md:2040`).
*   **Storage warning every load:** OPFS unavailable → using IndexedDB/memory; check private-browsing; memory = no persistence (`README-1.md:2052`).
*   **Export/import fails:** Validate .img format/version/size, Worker errors, storage quota (`README-1.md:2066`).
*   **`curl` cannot resolve:** Check network enabled, network.js DNS bridge (`README-1.md:2077`).
*   **HTTPS fails:** Check CORS, endpoint headers, supported method (`README-1.md:2086`).
*   **Non-HTTP fails:** Expected - no raw TCP/UDP/ICMP (`README-1.md:2097`).
*   **Emscripten build fails:** Ensure no conflicting system Emscripten, use pinned emsdk (`README-1.md:2107`).
*   **Unpinned dependency CI reject:** Update `versions.lock` with exact digest same PR (`README-1.md:2113`).
*   **Image size reject:** Check packages/overlay/compression, don't silently increase budget (`README-1.md:2123`).

If build fails generally, consult Troubleshooting before opening issue (`README-1.md:238`).

## 13. FAQ Usage Highlights (`README-1.md:2539`)

*   Base does NOT include Node.js; Standard does (`README-1.md:2542`).
*   Alpine root not writable; use writable hda disk (`README-1.md:2556`).
*   Persistent data in OPFS hda, not cloud sync v1 (`README-1.md:2565`).
*   9P not writable by design, hybrid separates system/user data (`README-1.md:2584`).
*   SquashFS not initrd; minimal cpio only for kernel test (`README-1.md:2592`).
*   `curl` HTTP/HTTPS may work via bridge subject to CORS; `ping`/`ssh` raw no (`README-1.md:2609`).
*   8s boot is target, not guaranteed until `docs/BENCHMARKS.md` entry (`README-1.md:2659`).
*   Dedicated Worker avoids concurrent handle contention (`README-1.md:2681`).
*   Do not fork core source; use profile+overlay+bridge (`README-1.md:2717`).

## 14. References

*   `README-1.md:2` Quick Start
*   `README-1.md:8` Running Locally
*   `README-1.md:9` Deployment
*   `README-1.md:10` Storage Model
*   `README-1.md:11` HTTP/HTTPS Egress
*   `README-1.md:21` Troubleshooting
