# MECHANISM.md - Core Mechanisms

> **Source of Truth:** `README-1.md` is canonical. Derived from `README-1.md:4`, `README-1.md:10`, `README-1.md:11`, `README-1.md:12`, `README-1.md:13`, `README-1.md:14`, `README-1.md:15`.

## 1. Emulation Mechanism - v86

**Why v86:** Allows normal x86_64 binaries without recompiling every app to WASI (`README-1.md:146`). No new emulator for v1.

**Mechanism:**

```
Browser WASM runtime → v86 WASM (x86_64 CPU + VirtIO block/9P/net + VGA/UART) → Linux kernel
```

*   Compiled via Emscripten exact `versions.lock` via emsdk (`README-1.md:621`); pinned submodule (`README-1.md:152`).
*   Boot gating: `autostart:false` → `verifyIntegrity()` → `new V86(config).run()` (`README-1.md:1342`).

**v86 Config Mechanism** `README-1.md:1253`:

```js
{
  wasm_path, memory_size: 256*1024*1024, vga_memory_size: 8*1024*1024,
  bios: {url}, vga_bios: {url}, bzimage: {url},
  filesystem: {baseurl: "/assets/rootfs-base/"}, // immutable 9P root
  disk: {async:true, storage_bridge:true}, // writable hda
  screen_container, network_relay_url:null, ac97:false, autostart:false
}
```

Two logically different paths: `filesystem.baseurl` (SquashFS) vs `hda` block disk (Worker→OPFS) (`README-1.md:1298`). Do not treat as same (`README-1.md:1321`).

Tier variations only in memory, rootfs asset, disk size, packages, display (`README-1.md:1362`).

## 2. Boot Mechanism

### 2.1 Kernel Command Line Mechanism

Product must boot with 9P contract (`README-1.md:1328`):

```
root=host9p rootfstype=9p rootflags=trans=virtio
```

Version-controlled with v86 config (`README-1.md:1337`).

### 2.2 Two Boot Paths

*   **Isolation test:** `bzImage + initramfs-minimal.cpio` via `-initrd` under QEMU to prove kernel (`README-1.md:392`).
*   **Product:** `bzImage + host9p SquashFS via filesystem.baseurl + hda raw disk via Worker` - SquashFS never as initrd (`README-1.md:404`, `README-1.md:1324`).

### 2.3 Boot Waterfall Mechanism (`README-1.md:1833`)

Instrumented via `performance.mark/measure`:

```
page load → capability probe → artifact fetch → integrity verification → WASM instantiate → v86 init → kernel decompression → kernel boot → 9P root availability → writable disk availability → filesystem mount → login prompt
```

## 3. Storage Mechanism - Hybrid Root/Disk

**Design intent:** Separate immutable OS root from writable user data (`README-1.md:344`) - small base, fast startup, block semantics, export/import, no writable 9P (`README-1.md:374`).

### 3.1 Immutable Root Mechanism (`README-1.md:832`)

```
Alpine SquashFS → v86 filesystem.baseurl → VirtIO 9P → Linux root=host9p
```

*   Read-only, immutable at runtime, distributed as SquashFS, verified before boot (`README-1.md:834`).

### 3.2 Writable Block Disk Mechanism (`README-1.md:865`)

```
Linux block device → v86 hda → storage bridge → dedicated Worker → OPFS → IndexedDB → memory
```

*   Raw image `build/disk-base.img` containing `/home /root /opt` (`README-1.md:589`); second SquashFS not required.
*   Not making 9P writable is invariant (`README-1.md:889`).

### 3.3 Storage Worker Mechanism (`README-1.md:914`)

```
v86 ↔ read/write requests ↔ storage bridge ↔ Dedicated Worker ↔ {OPFS, IndexedDB, memory}
```

*   Single Worker owns handle, serializes operations, no other module manipulates disk file (`README-1.md:918`).

### 3.4 Backend Hierarchy Mechanism (`README-1.md:889`)

1.  **OPFS** - primary, sync access handles
2.  **IndexedDB** - fallback
3.  **Memory** - last resort, non-dismissible warning, data lost on tab close (`README-1.md:910`)

Capability-driven selection via detection of SharedArrayBuffer, cross-origin isolation, OPFS sync handles, memory limits (`README-1.md:1926`).

### 3.5 Disk API Mechanism (`README-1.md:939`)

| Method | Mechanism | Requirements |
|--------|-----------|--------------|
| `open()` | Locate/init persistent disk, verify metadata/version | Return handle/context |
| `read(offset,length)` | Bounds validation, deterministic, no partial on invalid range | Serialized via Worker |
| `write(offset,data)` | Bounds validation, quota-safe, no partial commit exposure | Serialized |
| `flush()` | Commit pending writes per backend durability model | - |
| `truncate(size)` | Reject unsafe values, preserve metadata consistency | - |
| `size()` | Return logical disk size | - |
| `export()` | Export raw `.img` → browser download | - |
| `import()` | Validate type/format/version/size/integrity before import | - |
| `close()` | Release Worker/backend resources | - |

Tests must cover invalid offsets/lengths/sizes, closed handles, backend failures (`README-1.md:1662`).

### 3.6 Atomic Write Mechanism (`README-1.md:1026`)

```
write temporary → flush → finalize/rename
```

Must not report success when backend fails partway; replay protection via Worker serialization.

*   **Quota test:** `write → simulated quota exhaustion → reopen → verify no application-level corruption` (`README-1.md:1623`).
*   **Export/import test:** `export → import → read → verify identical` (`README-1.md:1636`).

### 3.7 Encryption at Rest Mechanism (Opt-in `README-1.md:1040`)

*   Web Crypto AES-GCM, off by default, key never in persistent storage, overhead measured before claims (`README-1.md:1048`).

## 4. Network Mechanism - HTTP/HTTPS Egress Bridge

**Terminology:** HTTP/HTTPS egress bridge, not general Internet (`README-1.md:1071`).

### 4.1 Translation Mechanism (`README-1.md:1080`)

```
Guest process (socket/connect/send/recv) → Linux TCP/IP → Ethernet frames → VirtIO-net → v86 → network.js (SLIRP-style: terminates guest TCP, extracts HTTP/HTTPS request, issues browser fetch) → Browser network stack → HTTP/HTTPS response → network.js → guest TCP segments → VirtIO-net → Linux
```

Guest believes normal TCP; no `fetch()` directly from guest (`README-1.md:1123`).

### 4.2 Supported vs Unsupported Mechanism

**Supports** (`README-1.md:1128`): HTTP, HTTPS, browser-compatible methods, DNS via bridge resolver.

**Explicitly not** (`README-1.md:1136`): raw TCP passthrough, raw UDP, ICMP/ping, arbitrary socket forwarding, SSH raw transport, WebSocket relay, WebRTC P2P, server-side relay. Guest can create TCP socket but only HTTP/HTTPS translated (`README-1.md:1150`).

Tests: `guest curl → HTTP/HTTPS endpoint → successful response` + `non-HTTP protocol → clean failure` with explicit error, not silent success (`README-1.md:1672`).

### 4.3 CORS Mechanism (`README-1.md:1153`)

Resulting browser `fetch()` subject to normal same-origin/CORS; no bypass (`README-1.md:1159`). Expected failure if endpoint rejects browser origin.

### 4.4 DNS Mechanism (`README-1.md:1166`)

Guest DNS handled by bridge-level resolver, not raw UDP/53; deterministic failure path if resolution unavailable (`README-1.md:1170`).

### 4.5 Default Mechanism

Networking OFF by default (`README-1.md:1174`), UI clearly communicates when enabled, no public network-enabled build with `root`/no password (`README-1.md:1185`).

## 5. Display & Input Mechanism

### 5.1 Display Mechanism (`README-1.md:1190`)

*   **Default Canvas2D** with dirty-rectangle updates (avoid full-frame redraw `README-1.md:1202`).
*   **Experimental WebGL2** via `?gpu=1` flag (`README-1.md:1212`) - not GPU passthrough.
*   Resolution 1024x768 target, tier-configurable (`README-1.md:1242`).

### 5.2 Input Mechanism (`README-1.md:1221`)

```
Keyboard/Mouse/Touch DOM events → input.js → PS/2/device emulation → Linux
```

Touch includes basic on-screen trackpad, functional but not polished v1 (`README-1.md:1236`).

## 6. Integrity Verification Mechanism (`README-1.md:1486`)

**Targets:** v86 WASM, Linux kernel, Alpine root, BIOS artifacts, writable-disk seed (`README-1.md:1490`).

**Mechanism:** Web Crypto SHA-256 before boot:

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

Boot awaits verification before `emulator.run()` (`README-1.md:1520`). Release `build/manifest.json` + `.sig` signed (`README-1.md:1522`); CI tamper test: modify one byte → boot rejected (`README-1.md:1540`).

## 7. Security Mechanism (`README-1.md:1372`)

| Layer | Provides | Not Guaranteed |
|-------|----------|----------------|
| Browser/WASM sandbox | Defense-in-depth against host code execution | No independent pen-test v1 |
| Boot integrity | SHA-256 before boot | Not detect malicious signed artifact |
| Supply chain | Exact pinning + SBOM | No audit of every upstream |
| Network | Off by default; HTTP/HTTPS only | No raw egress control (no relay) |
| Persistence | Dedicated Worker + atomic strategy | Browser profile access can expose unencrypted data |
| Device emulation | Automated fuzzing of VirtIO block/VGA/UART | Coverage not exhaustive |

*   Depends on browser, v86, kernel, rootfs, APIs, app code, pipeline (`README-1.md:1412`).
*   Supply chain: every dep pinned in `versions.lock` (`README-1.md:1474`), SBOM, second maintainer for security changes (`README-1.md:1482`).
*   Persistent data default unencrypted; protect browser profile or use app-level encryption (`README-1.md:1464`).

## 8. Browser Compatibility Mechanism (`README-1.md:1903`)

Capability detection selects backend and SMP:

*   Probes: SharedArrayBuffer, cross-origin isolation, OPFS, OPFS sync handles, memory limits (`README-1.md:1926`).
*   Falls back silently? No - must select correct fallback, show warning if memory-only (`README-1.md:1933`, `README-1.md:910`).

## 9. Invariants Enforcement Mechanism (`README-1.md:2762`)

20 invariants including: Alpine root immutable & 9P-served, SquashFS not initrd, writable disk separate as `hda`, Worker-owned I/O, OPFS primary, network off & HTTP/HTTPS only, CORS bypass prohibited, boot blocked until integrity, all deps pinned, disclosure non-bypassable, etc.

## 10. References

*   `README-1.md:4` Architecture Overview
*   `README-1.md:10` Storage Model
*   `README-1.md:11` HTTP/HTTPS Egress Bridge
*   `README-1.md:13` v86 Configuration Reference
*   `README-1.md:14` Security Model
*   `README-1.md:15` Integrity Verification
