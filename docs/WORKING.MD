# WORKING.md - How LinuxHTML Works

> **Source of Truth:** `README-1.md` is canonical. This doc explains end-to-end working, derived from `README-1.md:2`, `README-1.md:4`, `README-1.md:10`, `README-1.md:11`, `README-1.md:12`.

## 1. Mental Model

LinuxHTML is **not** an OS running natively in the browser. Stack:

```
Browser Tab (hosts WebAssembly)
   → WebAssembly executes v86 x86_64 emulator
      → v86 emulates CPU, VirtIO devices, BIOS
         → Linux 6.6 kernel boots inside emulated machine
            → Alpine 3.19 userspace runs as guest
```

Precisely: `README-1.md:5` Linux 6.6 + Alpine 3.19 inside v86, compiled to WASM, hosted client-side.

## 2. First-Run Sequence

`README-1.md:206` Expected sequence:

```
Browser page
   ↓
Capability probe (SharedArrayBuffer, OPFS, cross-origin isolation)
   ↓
fetch + integrity verification (SHA-256 via Web Crypto)
   ↓
First-run disclosure (non-bypassable)
   ↓
v86 initialization (instantiate WASM, configure 9P + hda)
   ↓
Linux boot (bzImage decompression → 9P root mount → hda mount)
   ↓
Login prompt (root, no password in dev)
```

Boot gated: `autostart:false` until `verifyIntegrity()` succeeds (`README-1.md:1342`), `README-1.md:1486`.

```js
async function boot() {
  await verifyIntegrity(); // SHA-256 all artifacts
  const emulator = new V86(baseTierConfig);
  emulator.run();
}
```

Target boot: ≤8s desktop (`README-1.md:224`) - target, not measured until `docs/BENCHMARKS.md`.

## 3. Two-Filesystem Working

Core design (`README-1.md:344`):

```
Linux guest
   ├── 9P root (immutable) → served via v86 filesystem.baseurl → SquashFS
   └── hda (writable) → raw disk image → storage Worker → OPFS
```

**Immutable root path:**

```
Alpine SquashFS → v86 filesystem.baseurl → VirtIO 9P → Linux root=host9p rootfstype=9p rootflags=trans=virtio
```
`README-1.md:844`, `README-1.md:1328`.

**Writable path:**

```
Linux block device (hda) → v86 hda → storage bridge → dedicated Worker → OPFS → IndexedDB fallback → memory fallback
```
`README-1.md:869`. Contains `/home`, `/root`, `/opt` (`README-1.md:589`). Never make 9P writable (`README-1.md:889`).

Hybrid benefits: small base, fast startup, conventional block semantics, export/import, clean separation (`README-1.md:374`).

## 4. Storage Working

**Hierarchy** `README-1.md:889`:

1.  OPFS (primary) - sync access handles
2.  IndexedDB (fallback)
3.  Memory (last resort, persistent warning, data lost on tab close `README-1.md:910`)

**Worker mediation** `README-1.md:917`:

```
v86 → read/write requests → storage bridge → Dedicated Worker → {OPFS, IndexedDB, memory}
```

Worker owns handle, serializes ops, no other module touches disk (`README-1.md:918`).

**Disk API** (`README-1.md:939`):
`open()` → init/verify disk, `read(offset,length)` bounds-checked, `write(offset,data)` quota-safe, `flush()` durability, `truncate(size)`, `size()`, `export()` → download `.img`, `import()` validates format/version/size, `close()`.

**Atomic policy:** `write temporary → flush → finalize/rename` (`README-1.md:1028`), never report success on partial backend failure.

**Persistence example:**
```
open → write → flush → read → verify → simulated quota exhaustion → reopen → verify no corruption → export → import → verify identical
```
`README-1.md:1604`.

## 5. Display & Input Working

**Display** `README-1.md:1190`:
*   Default: Canvas2D with dirty-rectangle updates (no full-frame redraw)
*   Experimental: WebGL2 via `?gpu=1` flag (`README-1.md:1214`) - not GPU passthrough
*   Resolution: 1024x768 target, tier-configurable (`README-1.md:1242`)

**Input** `README-1.md:1221`:
```
Keyboard/Mouse/Touch DOM events → input.js → PS/2/device emulation → Linux
```
Touch includes on-screen trackpad, functional but not polished in v1 (`README-1.md:1238`).

## 6. Networking Working - HTTP/HTTPS Egress Bridge

Not general internet (`README-1.md:1073`).

```
Guest process (socket/connect/send/recv) → Linux TCP/IP → VirtIO-net → v86 → network.js → SLIRP-style translation → browser fetch() → Browser stack → HTTP/HTTPS response → guest TCP segments
```
`README-1.md:1080`.

Guest believes it uses normal TCP; actually terminated and re-issued as `fetch()`.

*   Supported: HTTP, HTTPS, DNS via bridge resolver (`README-1.md:1166`)
*   Unsupported: raw TCP/UDP, ICMP/ping, SSH raw, WebSocket relay, WebRTC P2P, server relay (`README-1.md:1136`)
*   CORS applies (`README-1.md:1153`) - no bypass allowed (`README-1.md:1159`). Endpoint rejecting browser origin is unreachable (expected).
*   DNS handled by bridge resolver, deterministic failure path (`README-1.md:1169`).
*   Default OFF (`README-1.md:1174`), UI must indicate when enabled, no network-enabled build with root/no-password shipped publicly (`README-1.md:1185`).

## 7. Integrity Verification Working

All critical artifacts verified before boot via Web Crypto SHA-256 (`README-1.md:1486`):

```js
async function verifyIntegrity(url, expectedHash) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const actual = bytesToHex(digest);
  if (actual !== expectedHash) throw new Error(`Integrity check failed for ${url}: expected ${expectedHash}, got ${actual}`);
  return buffer;
}
```

Release contains `build/manifest.json` + `manifest.json.sig` signed with release key (`README-1.md:1522`); tamper test: modify one byte → boot rejected (`README-1.md:1540`).

## 8. Boot Architecture Variants

*   **Test kernel isolation:** `bzImage + initramfs-minimal.cpio` via `-initrd` under QEMU (`README-1.md:392`).
*   **Product:** `bzImage + host9p root (filesystem.baseurl SquashFS) + hda writable disk` - SquashFS never as initrd (`README-1.md:404`, `README-1.md:1324`).

## 9. Browser Capability Detection

Compatibility is capability-based, not UA-only (`README-1.md:292`):
*   SharedArrayBuffer availability, cross-origin isolation (COOP/COEP), OPFS, OPFS sync handles, memory limits (`README-1.md:1926`).
*   Selects fallback (OPFS → IndexedDB → memory) rather than failing silently (`README-1.md:1933`).

Matrix `README-1.md:1903`:
*   Chrome/Edge 120+: OPFS, SMP with PWA+COOP/COEP (reference)
*   Firefox 122+: OPFS or IndexedDB, capability-dependent SMP
*   Safari macOS 17+: IndexedDB fallback, no SMP
*   Safari iOS: Partial, IndexedDB, tighter memory/tab eviction
*   Chrome Android: OPFS where available, ≤15s target.

## 10. Deployment Working

*   **PWA** `README-1.md:762`: `index.html → assets/{v86.wasm, kernel, rootfs, BIOS} → service worker (versioned, update visible, no silent reload `README-1.md:815`)`. Requires static hosting with COOP/COEP headers via `tools/serve.py` (`README-1.md:198`).
*   **Single-file** `README-1.md:788`: `tools/pack.py` embeds artifacts via base64 into `build/linuxhtml.html` → 33% overhead (`README-1.md:797`), offline but single-core (`file://` cannot provide cross-origin isolation `README-1.md:811`).

## 11. Example Flow: User Edits File

1. User types in terminal (Canvas2D) → input.js → PS/2 → Linux receives keystrokes
2. `vim /home/user/file.txt` → writes to `/home` on `hda` → VirtIO block → storage bridge → Worker → OPFS write → flush
3. Refresh tab → capability probe → verify → v86 boots → 9P root mounts → Worker opens OPFS disk → `/home` remounted → file persists → `export()` downloads `.img`

## 12. References

*   `README-1.md:4.1` High-level architecture
*   `README-1.md:4.2` Two-filesystem design
*   `README-1.md:4.4` Boot architecture
*   `README-1.md:10` Storage Model
*   `README-1.md:11` HTTP/HTTPS Egress Bridge
*   `README-1.md:12` Display & Input
