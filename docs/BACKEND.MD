# BACKEND.md - LinuxHTML Backend Architecture

> **Source of Truth:** `README-1.md` is the single source of truth. This document is a derived view focused on backend internals. Do not edit `README-1.md`. If a conflict exists, `README-1.md` wins.

## 1. Overview

LinuxHTML backend is entirely client-side. There is no required server-side VM or SSH tunnel. The backend consists of a Linux kernel + Alpine userspace running inside the v86 x86_64 emulator compiled to WebAssembly, hosted in a browser tab.

```
Browser Tab → main.js → v86 WASM → Linux 6.6 LTS → Alpine 3.19
```

Precise terminology: **browser-based Linux development sandbox** - not "Secure browser VM" or "OS running natively in browser" (`README-1.md:79`).

## 2. High-Level Backend Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser Tab                           │
│  main.js                                                    │
│    ├── capability probe                                     │
│    ├── fetch + verify artifacts                             │
│    ├── first-run disclosure                                 │
│    └── instantiate v86                                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                 v86 WebAssembly                       │  │
│  │  x86_64 emulated CPU | VirtIO block | VirtIO 9P      │  │
│  │  VirtIO network | Console / VGA                       │  │
│  └───────────────┬───────────────────┬───────────────────┘  │
│                  │                   │                      │
│          Immutable 9P root       Writable hda               │
│          Alpine SquashFS         raw disk image             │
│                  │               storage Worker → OPFS      │
│                  │               → IndexedDB → memory       │
│          ├── display.js → Canvas2D / WebGL2                │
│          ├── input.js → keyboard/mouse/touch → PS/2        │
│          └── network.js → HTTP/HTTPS egress bridge         │
└─────────────────────────────────────────────────────────────┘
```

Source: `README-1.md:298`

## 3. Core Components

### 3.1 Emulator Layer - v86

*   **Role:** x86_64 hardware emulation compiled to WebAssembly via Emscripten.
*   **Why v86:** Runs normal x86_64 binaries without recompiling to WASI. No new emulator built for v1. Pinned as git submodule; fork only on upstream blocker (`README-1.md:144`).
*   **Build:** `src/emulator/build.sh` installs exact Emscripten from `versions.lock` via emsdk. Do not use system-wide Emscripten (`README-1.md:621`).
*   **Configuration tiers:** `src/emulator/config/micro.js`, `base.js`, `standard.js` mirror same architecture, vary only memory, rootfs asset, disk size, packages (`README-1.md:1360`).

Conceptual Base config (`README-1.md:1259`):

```js
export const baseTierConfig = {
  wasm_path: "/assets/v86.wasm",
  memory_size: 256 * 1024 * 1024,
  vga_memory_size: 8 * 1024 * 1024,
  bios: { url: "/assets/seabios.bin" },
  vga_bios: { url: "/assets/vgabios.bin" },
  bzimage: { url: "/assets/linux-6.6-linuxhtml.bzImage" },
  filesystem: { baseurl: "/assets/rootfs-base/" },
  disk: { async: true, storage_bridge: true },
  network_relay_url: null,
  screen_container: document.getElementById("screen"),
  ac97: false,
  autostart: false
};
```

Key invariant: `autostart: false` until `verifyIntegrity()` succeeds (`README-1.md:1342`).

### 3.2 Kernel Layer

*   **Version:** Linux 6.6 LTS (`README-1.md:103`).
*   **Config:** `src/kernel/linuxhtml_defconfig` (`README-1.md:432`).
*   **Build output:** `src/kernel/bzImage` (`README-1.md:512`).
*   **Testing isolation:** Minimal BusyBox initramfs `src/kernel/initramfs-minimal/build.sh` → `initramfs-minimal.cpio` exists **only** for native QEMU kernel testing, not product boot (`README-1.md:520`).
*   **QEMU gate:** Must boot under `qemu-system-x86_64 -kernel bzImage -initrd initramfs-minimal.cpio -nographic -m 256M` and reach shell prompt (`README-1.md:538`).

### 3.3 Root Filesystem Layer

*   **Base:** Alpine Linux 3.19 userspace (`README-1.md:104`).
*   **Build:** `src/rootfs/Dockerfile` + `overlay/` → `build/rootfs-base.squashfs` (`README-1.md:564`). Digest pinned in `versions.lock`.
*   **Immutability:** Alpine SquashFS is **read-only, immutable 9P root** served via `filesystem.baseurl` → VirtIO 9P → `root=host9p rootfstype=9p rootflags=trans=virtio` (`README-1.md:854`). Never passed as `-initrd` (`README-1.md:573`).
*   **Tiers:**
    *   micro: BusyBox only, 8MB cap, 128MB RAM
    *   base: + gcc git python3 vim, 15MB cap, 256MB RAM
    *   standard: base + Node.js, 25MB cap, 512MB RAM (`README-1.md:664`).

### 3.4 Storage Backend

Two-filesystem design (`README-1.md:344`):

```
Linux guest
   ├── 9P root (read-only) → Alpine base (/bin, /usr, /lib)
   └── hda block disk (writable) → /home, /root, /opt
```

**Writable disk:**
*   Raw virtual disk image `build/disk-base.img` (`README-1.md:582`), exposed as `hda`.
*   I/O routed through dedicated storage Worker (`README-1.md:917`): `v86 → storage bridge → Worker → OPFS → IndexedDB fallback → memory fallback`.
*   Worker owns handle, serializes ops; no other module may directly manipulate disk file (`README-1.md:918`).
*   Atomic write policy: `write temporary → flush → finalize/rename` (`README-1.md:1028`).

**Backend hierarchy (`README-1.md:889`):**
1.  Primary: OPFS (sync access handles)
2.  Fallback: IndexedDB
3.  Last resort: in-memory (non-dismissible warning, data lost on tab close `README-1.md:910`).

**Disk API** (`README-1.md:939`): `open()`, `read(offset,length)`, `write(offset,data)`, `flush()`, `truncate(size)`, `size()`, `export()`, `import()`, `close()` - all bounds-validated, serialized via Worker, quota-safe.

### 3.5 Bridge Layer (`src/bridge/`)

*   `storage.js` - disk API to Worker
*   `network.js` - HTTP/HTTPS egress bridge (SLIRP-style translation: terminates guest TCP, extracts HTTP request, issues browser `fetch()` `README-1.md:1080`)
*   `display.js` - Canvas2D (dirty-rect) / WebGL2 experimental (`?gpu=1`)
*   `input.js` - DOM keyboard/mouse/touch → PS/2 emulation

### 3.6 UI Layer (`src/ui/`)

*   `terminal/`, `statusbar/`, `firstrun/` - first-run disclosure non-bypassable (`README-1.md:745`).

## 4. Backend Directory Structure

```
linuxhtml/
├── build/              # gitignored: linuxhtml.html, pwa/, rootfs/, manifests/
├── src/
│   ├── emulator/config/{micro,base,standard}.js + build.sh
│   ├── kernel/{linuxhtml_defconfig, initramfs-minimal/build.sh, patches/, build.sh}
│   ├── rootfs/{Dockerfile, overlay/, build.sh}
│   ├── bridge/{storage.js, network.js, display.js, input.js}
│   ├── ui/{terminal/, statusbar/, firstrun/}
│   └── main.js
├── tools/{pack.py, serve.py, verify_versions.py, bench/, test/}
├── examples/devbox/{profile.json, _headers}
├── docs/{ARCHITECTURE.md, SECURITY.md, BENCHMARKS.md, API.md}
├── versions.lock
├── Makefile, build.sh, requirements.txt
```

Source: `README-1.md:412`

## 5. Security Backend Considerations

*   Browser/WASM sandbox is defense-in-depth, not escape-proof (`README-1.md:1381`).
*   Networking off by default, only HTTP/HTTPS bridge, no CORS bypass (`README-1.md:1174`).
*   OPFS data not encrypted at rest by default; Web Crypto AES-GCM opt-in only (`README-1.md:1040`).
*   Supply chain: all deps pinned in `versions.lock`, SBOM generated (`README-1.md:1474`).
*   Integrity: SHA-256 verification of wasm, kernel, rootfs, BIOS before boot; release `manifest.json` + `.sig` (`README-1.md:1486`).

## 6. Backend Invariants (from `README-1.md:2762`)

1. Alpine root immutable & served via 9P
2. SquashFS not passed as initrd
3. Writable disk separate, exposed as `hda` block device
4. Persistent I/O owned by storage Worker
5. OPFS primary, IndexedDB fallback, memory last resort with warning
6. Networking disabled by default; HTTP/HTTPS bridge only
7. Boot blocked until integrity verification succeeds
8. All dependencies pinned in `versions.lock`

## 7. Performance Backend Targets

*   Boot waterfall instrumented with `performance.mark/measure` (`README-1.md:1861`).
*   Targets (not measured until `docs/BENCHMARKS.md`): Desktop Chrome ≤8s, Android ≤15s, Base ≤15MB (`README-1.md:1820`).

## 8. References

*   `README-1.md:4` Architecture Overview
*   `README-1.md:10` Storage Model
*   `README-1.md:13` v86 Configuration Reference
*   `README-1.md:14` Security Model
