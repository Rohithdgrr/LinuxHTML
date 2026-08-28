# PROCESS.md - Build, Boot & Runtime Processes

> **Source of Truth:** `README-1.md` is canonical. Derived from `README-1.md:6`, `README-1.md:8`, `README-1.md:17`, `README-1.md:18`.

## 1. Build Order & Instructions

Intentionally staged to isolate failures (`README-1.md:494`).

### Step 1 - Build Pinned Linux Kernel (`README-1.md:498`)

```bash
cd src/kernel
./build.sh
```

*   Obtains exact Linux 6.6.x version, verifies tarball SHA, applies `linuxhtml_defconfig`, builds → `src/kernel/bzImage` (`README-1.md:512`).
*   Does not depend on final Alpine rootfs.

### Step 2 - Build Minimal BusyBox Initramfs (`README-1.md:518`)

```bash
cd src/kernel/initramfs-minimal
./build.sh
```

*   Output: `initramfs-minimal.cpio` - exists only to test kernel independently, **not** product root (`README-1.md:533`).

### Step 3 - Native QEMU Kernel Boot Gate (`README-1.md:536`)

```bash
qemu-system-x86_64 \
  -kernel src/kernel/bzImage \
  -initrd src/kernel/initramfs-minimal/initramfs-minimal.cpio \
  -serial stdio \
  -nographic \
  -m 256M
```

*   Acceptance: interactive shell prompt appears (`README-1.md:548`). If fails, do not debug v86/WASM/OPFS - failure is kernel config/initramfs (`README-1.md:552`).

### Step 4 - Build Real Alpine Root (`README-1.md:556`)

```bash
cd src/rootfs
./build.sh --tier base
```

*   Outputs immutable image e.g. `build/rootfs-base.squashfs` (`README-1.md:566`). Digest pinned in `versions.lock`. This is the **read-only 9P root**, not passed as `-initrd` (`README-1.md:573`).

### Step 5 - Build Writable Disk Image (`README-1.md:576`)

*   Logical output: `build/disk-base.img` (`README-1.md:582`) - raw disk containing `/home`, `/root`, `/opt` layout (`README-1.md:591`). Layout must be documented and stable for export/import (`README-1.md:594`). Backed by storage Worker in browser.

### Step 6 - Native QEMU Validation of Real Guest (`README-1.md:600`)

Must match final v86 kernel cmdline/rootfs/disk layout. Acceptance:

*   Linux boots, Alpine root accessible, writable block disk detected, `/home /root /opt` mountable, file created on writable disk survives unmount/remount (`README-1.md:608`).
*   SquashFS must not be incorrectly passed as initrd (`README-1.md:617`).

### Step 7 - Build v86 to WebAssembly (`README-1.md:619`)

```bash
cd src/emulator
./build.sh
```

*   Installs exact Emscripten from `versions.lock` via emsdk; do not depend on system Emscripten (`README-1.md:626`).

### Step 8 - Pack Browser Artifacts (`README-1.md:630`)

```bash
python3 tools/pack.py --tier base --target pwa
python3 tools/pack.py --tier base --target single-file
```

*   Outputs: `build/pwa/{index.html, sw.js, manifest.webmanifest, assets/}` and `build/linuxhtml.html` (`README-1.md:414`).

### Step 9 - Verify (`README-1.md:642`)

```bash
python3 tools/verify_versions.py
python3 -m pytest tools/test/
```

### Canonical One-Shot (`README-1.md:652`)

```bash
./build.sh --tier base --target pwa --verify
```

Runs pipeline in same order as CI.

## 2. Build Tiers & Configuration (`README-1.md:664`)

| Tier | Compressed Cap | VM RAM | Contents |
|------|----------------|--------|----------|
| micro | 8 MB | 128 MB | BusyBox only, no package manager |
| base | 15 MB | 256 MB | musl + BusyBox + gcc + git + python3 + vim |
| standard | 25 MB | 512 MB | Base + Node.js + additional languages |

*   Node.js is Standard-only (`README-1.md:671`), never assume in Base.
*   Size limits enforced in CI; >5% over fails (`README-1.md:677`).
*   Immutable roots: `rootfs-micro.squashfs`, `rootfs-base.squashfs`, `rootfs-standard.squashfs` via 9P (`README-1.md:683`).
*   Writable disk conceptually separate: Alpine root `/bin /sbin /usr /lib` vs disk `/home /root /opt` (`README-1.md:699`).

## 3. Running Locally (`README-1.md:718`)

```bash
python3 tools/serve.py
```

*   Do **not** use `python3 -m http.server` for PWA - required headers: `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` (`README-1.md:198`) for cross-origin-isolated SharedArrayBuffer/SMP (`README-1.md:204`).
*   Prints `http://localhost:8080` (`README-1.md:192`).
*   Single-file can be opened as file but no SMP (`README-1.md:741`).
*   First-run disclosure cannot be bypassed by query param/flag/hidden UI (`README-1.md:745`).

## 4. Boot Process Detail

### 4.1 Capability Probe → Integrity → Boot (`README-1.md:206`)

```
page load → capability probe → artifact fetch → integrity verification → WASM instantiate → v86 init → kernel decompression → kernel boot → 9P root availability → writable disk availability → filesystem mount → login prompt
```
Benchmark must measure each stage via `performance.mark/measure` (`README-1.md:1833`, `README-1.md:1861`).

### 4.2 Boot Gating (`README-1.md:1342`)

```js
async function boot() {
  await verifyIntegrity(); // SHA-256 via Web Crypto
  const emulator = new V86(baseTierConfig);
  emulator.run();
}
```
`autostart:false` until verification succeeds.

### 4.3 Kernel Command Line (`README-1.md:1327`)

Product guest must include:

```
root=host9p rootfstype=9p rootflags=trans=virtio
```

Additional args version-controlled with v86 config (`README-1.md:1337`).

## 5. Deployment Process

### 5.1 PWA (`README-1.md:761`)

Primary distribution:

```
index.html → assets/{v86.wasm, kernel, rootfs, BIOS} → service worker (versioned)
```

Requires static hosting with COOP/COEP. Updates: service-worker cache versioned, shows "Update available", no silent reload (`README-1.md:815`).

### 5.2 Single-File (`README-1.md:788`)

`tools/pack.py` embeds binaries via base64 into `build/linuxhtml.html` → ~33% overhead (`README-1.md:797`), manual replacement updates (`README-1.md:822`), single-core due to `file://` no isolation (`README-1.md:811`).

### 5.3 SMP (`README-1.md:803`)

| Distribution | SMP |
|--------------|-----|
| PWA + COOP/COEP | Supported where browser permits |
| Single-file file:// | No |
| Safari/WebKit | Unsupported v1 |

## 6. Runtime Processes

### 6.1 Storage Runtime

*   All I/O serialized through one dedicated Worker owning handle (`README-1.md:917`).
*   Hierarchy: OPFS → IndexedDB → memory (warning, data lost on tab close `README-1.md:910`).
*   Disk API logical calls: `open/read/write/flush/truncate/size/export/import/close` (`README-1.md:939`) with bounds validation, quota handling.
*   Atomic: `write temp → flush → finalize/rename` (`README-1.md:1028`).
*   Backup: local export/import only, no cloud sync v1, no localStorage/sessionStorage (`README-1.md:1052`).

### 6.2 Network Runtime

*   OFF by default (`README-1.md:1174`), UI communicates when enabled.
*   When enabled: guest TCP → network.js → fetch() → browser stack → response → guest TCP segments (`README-1.md:1080`). No CORS bypass (`README-1.md:1159`), no raw TCP/UDP/ICMP/ping/SSH/WebSocket/WebRTC/relay (`README-1.md:1136`).
*   DNS via bridge resolver, deterministic failure (`README-1.md:1166`).

### 6.3 Display/Input Runtime

*   Canvas2D dirty-rect; WebGL2 experimental `?gpu=1` (`README-1.md:1193`); 1024x768 default (`README-1.md:1242`).
*   Keyboard/Mouse/Touch DOM → input.js → PS/2 (`README-1.md:1221`); touch trackpad basic, not polished.

## 7. Release Process (`README-1.md:2240`)

Every tagged `vMAJOR.MINOR.PATCH` publishes: PWA, single-file, `manifest.json`, detached `manifest.json.sig`, benchmark entry, release notes (`README-1.md:2248`).

*   Kernel tracked: Linux 6.6.x pinned, hash in `versions.lock` (`README-1.md:2258`); maintenance job opens issue before EOL (`README-1.md:2267`).
*   No silent PWA updates (`README-1.md:2271`).
*   Benchmark entry must correspond to exact tag (`README-1.md:2283`).

## 8. Verification & Testing Process

See `MECHANISM.md` and `TODO.md` for details. Key gates:

*   Every PR: deps verify, kernel build, initramfs QEMU boot, rootfs build, real QEMU boot, WASM build, PWA+single-file pack, size check, Chromium smoke, storage/disk API, egress tests (`README-1.md:1730`).
*   Nightly: Firefox/WebKit suites, cross-browser, fuzzing, extended storage/network (`README-1.md:1749`).
*   Release: all PR + all browsers + fuzz review + benchmarks + manifest signing (`README-1.md:1760`).

## 9. Troubleshooting Process Hooks

Maps to `README-1.md:1966`: blank page/no boot splash → check COOP/COEP via `tools/serve.py`; `SharedArrayBuffer is not defined` → headers missing; boot freeze → DevTools console, fetch/CORS/hash/WASM; QEMU fails → check defconfig/initramfs; writable disk missing → hda config/Worker/OPFS/geometry/mount logs; storage warning → OPFS unavailable; export/import fails → format/version/size validation; curl failures → network enabled + DNS + CORS; non-HTTP fails → expected.

## 10. References

*   `README-1.md:6` Build Order
*   `README-1.md:7` Build Tiers
*   `README-1.md:8` Running Locally
*   `README-1.md:9` Deployment
*   `README-1.md:13` v86 Configuration
*   `README-1.md:17` CI/CD Pipeline
*   `README-1.md:21` Troubleshooting
