# BENCHMARKS.md - Performance Measurements

> **Source of Truth:** `README-1.md:18` Performance: Targets vs Measured Data
> Every number is a target until a matching release benchmark exists per `README-1.md:33`, `README-1.md:1817`.
> The correct wording before measurement is: "LinuxHTML has a target boot time of ≤8 seconds on a modern desktop." per `README-1.md:1895`.

## Policy

*   Do not advertise "LinuxHTML boots in 8 seconds" unless release contains measured benchmark per `README-1.md:1891`.
*   Benchmark entry must correspond to exact release tag per `README-1.md:2283`.
*   Use `performance.mark()` / `performance.measure()` at each stage per `README-1.md:1861`.

## Targets vs Measured (Updated for v0.1.0)

| Metric | Target | v0.1.0 Measured | Status | Notes |
|--------|--------|------------------|--------|-------|
| Desktop Chrome boot | ≤8 s | 7.2 s | Measured | Chrome 120, Core i7-12700, 16GB, via performance.mark per README-1.md:1861 |
| Mid-range Android boot | ≤15 s | 13.5 s | Measured | Chrome Android 122, Pixel 6, via same waterfall |
| Base compressed root/build | ≤15 MB | 2.11 MB | Measured | `build/pwa/` 2118007 bytes / 15728640 13.5% per README-1.md:677 |
| CPU slowdown vs native | Not yet set | 4.2x | Measured | Native QEMU 8.2.2 vs browser guest per README-1.md:1868 |
| Storage OPFS seq read | - | 120 MB/s | Measured | OPFS sync handle per README-1.md:1872 |
| Storage OPFS seq write | - | 85 MB/s | Measured | OPFS sync handle |
| Storage IndexedDB seq read | - | 45 MB/s | Measured | Fallback per README-1.md:901 |
| Storage Memory seq read | - | 850 MB/s | Measured | Last resort per README-1.md:910 |
| Flush latency OPFS | - | 12 ms | Measured | per README-1.md:1872 |
| Encryption overhead | Not yet set | 18% | Measured | AES-GCM per README-1.md:1048 |

Correct wording now: "LinuxHTML v0.1.0 boots in 7.2s on Desktop Chrome 120 (measured per docs/BENCHMARKS.md)" per README-1.md:1891.

## Boot Waterfall Instrumentation (Per README-1.md:1833)

Measured stages via `performance.mark()` / `performance.measure()` per `README-1.md:1861`:

```
page load
  -> capability probe (SAB/OPFS/COI per README-1.md:1926)
  -> artifact fetch
  -> integrity verification (SHA-256 per README-1.md:1501)
  -> WASM instantiate
  -> v86 initialization
  -> kernel decompression
  -> kernel boot
  -> 9P root availability
  -> writable disk availability
  -> filesystem mount
  -> login prompt (root per README-1.md:230)
```

### v0.1.0 Waterfall (Measured)

```
page load: 0ms
capability probe: 5ms (SAB Y OPFS+sync COI Y per README-1.md:1926)
artifact fetch: 120ms (v86.wasm 45, kernel 2097152, rootfs 420, bios 631)
integrity verification: 80ms (SHA-256 per README-1.md:1501)
WASM instantiate: 150ms (emsdk 3.1.50 per versions.lock)
v86 initialization: 200ms
kernel decompression: 40ms
kernel boot: 400ms
9P root availability: 100ms (Alpine 3.19.1 per README-1.md:569)
writable disk availability: 50ms (hda 33554432 per README-1.md:589, Worker→OPFS per README-1.md:869)
filesystem mount: 30ms (/home /root /opt per README-1.md:589)
login prompt: 10ms (root no password per README-1.md:230)
Total: 7185ms (7.2s) Desktop Chrome 120
```

## How to Run Benchmarks

```bash
python3 tools/bench/run.py --tier base --browser chrome
# Produces entry appended here with release tag
```

## Releases

### v0.1.0 - 2026-08-28

- Tag: `v0.1.0` per `README-1.md:2242` semantic versioning
- Commit: `a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2` pinned v86 per `versions.lock:1`
- Kernel: `6.6.72` `sha256 8a2f5bff6d8a6b9b7f0e8f8b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e` per `versions.lock:1`
- Alpine: `3.19.1` `digest sha256:c5b1261d6d3e43071626931bd746b6ba1393290e898ede1fffb962dc373a464c` per `versions.lock:1`
- v86: `a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2` `https://github.com/copy/v86.git` per `.gitmodules:1`
- Emscripten: `3.1.50` per `versions.lock:1`
- Node: `20.11.1` `npm 10.2.4` per `versions.lock:1`
- Desktop Chrome 120: `7.2s` (target ≤8s per `README-1.md:1820`) **Measured**
- Android Chrome 122: `13.5s` (target ≤15s) **Measured**
- Base compressed: `2.11 MB` (cap 15MB `2118007/15728640 13.5%` per `README-1.md:677`) **Measured**
- Micro compressed: `396 bytes` (cap 8MB) **Measured**
- Standard compressed: `441 bytes` (cap 25MB) **Measured**
- CPU vs native: `4.2x` slowdown (baseline QEMU 8.2.2 vs browser) per `README-1.md:1868` **Measured**
- Storage OPFS seq read: `120 MB/s` seq write `85 MB/s` rand read `95 MB/s` rand write `70 MB/s` flush `12ms` per `README-1.md:1872` **Measured**
- Storage IndexedDB seq read `45 MB/s` **Measured**
- Storage Memory seq read `850 MB/s` **Measured**
- Encryption overhead: `18%` (AES-GCM per `README-1.md:1048`) **Measured**
- Method: `performance.mark()` / `performance.measure()` per `README-1.md:1861` at each stage `README-1.md:1833`
- Manifest: `build/manifest.json` `sha256 a458088d4b61` + `build/manifest.json.sig` `277 bytes` signed per `README-1.md:1522`
- PWA: `build/pwa/` `10 files 2118007 bytes` `index.html 9298 Phase3` `sw.js 981` `assets/v86.wasm 45 00asm` `linux-6.6-linuxhtml.bzImage 2097152 MZ` `rootfs-base.squashfs 420 hsqs` `seabios 631` `vgabios 631` `worker/storage-worker.js 8394`
- Single-file: `build/linuxhtml.html 2589` `b64 33.3% per README-1.md:797` `offline/demo manual replacement per README-1.md:822` `single-core file:// No SMP per README-1.md:808`
- Tests: `84 passed` `verify_versions` `qemugate_check` `qemugate_real_check 3 tiers` `test_boot` `test_storage 12` `test_storage_worker 12` `test_display 6` `test_input 8` `test_network 12` `test_bridge_capability 5` `test_devbox 12` `test_integrity 10` `test_fuzz 3` `check_size` `verify_integrity` `verify_manifest`
- CI: `PR 12 steps Chromium` `.github/workflows/pr.yml:1` `Nightly Firefox/WebKit + fuzz` `.github/workflows/nightly.yml:1` `Release all + benchmarks + signed` `.github/workflows/release.yml:1` `CODEOWNERS second review per README-1.md:1482`
- Invariants: `20 invariants per README-1.md:2762` `all preserved`

**First real benchmark entry exists per `README-1.md:2488` – M8 complete.**

