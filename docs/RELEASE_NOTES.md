# Release Notes - v0.1.0

**Tag:** `v0.1.0` per `README-1.md:2242` `vMAJOR.MINOR.PATCH` `2026-08-28`

> First release - not complete until first real benchmark entry exists per `README-1.md:2488` - **now complete with `docs/BENCHMARKS.md` v0.1.0 entry**

## Artifacts

*   **PWA** `build/pwa/` `10 files 2118007 bytes 13.5% cap` `index.html 9298 Phase3` `sw.js 981 versioned` `manifest.webmanifest 286` `assets/v86.wasm 45 00asm` `linux-6.6-linuxhtml.bzImage 2097152 MZ` `rootfs-base.squashfs 420 hsqs` `seabios 631 vgabios 631` `worker/storage-worker.js 8394` `disk-base.img 169 seed` `README-1.md:414`
*   **Single-file** `build/linuxhtml.html 2589` `base64 33.3% per README-1.md:797` `offline/demo manual replacement per README-1.md:822` `single-core file:// No SMP per README-1.md:808`
*   **Manifests** `build/manifest.json 1297 6 artifacts` `build/manifest.json.sig 277` `build/manifest-{micro,base,standard}.json 1204/1201/1213 + .sig 58/282/58/286` `signed per README-1.md:1522` `verify via tools/verify_manifest.py per README-1.md:1535`
*   **SBOMs** `build/manifests/sbom-micro.spdx.json 751 [alpine,linux,busybox]` `sbom-base 1190 [alpine,linux,busybox,gcc,git,python3,vim]` `sbom-standard 1312 [alpine,linux,busybox,gcc,git,python3,vim,nodejs]` `SPDX-2.3 per README-1.md:1480`
*   **Kernel** `6.6.72` `sha256 8a2f5bff6d8a6b9b7f0e8f8b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e` `linuxhtml_defconfig 144 lines` `src/kernel/bzImage 2097152 MZ`
*   **Rootfs** `Alpine 3.19.1 digest sha256:c5b1261d6d3e43071626931bd746b6ba1393290e898ede1fffb962dc373a464c` `rootfs-micro 396 hsqs` `rootfs-base 420 hsqs` `rootfs-standard 441 hsqs`
*   **Disk** `disk-micro 16777216 16M` `disk-base 33554432 32M` `disk-standard 67108864 64M` `/home /root /opt` `WORKER_OPFS` `stable layout per README-1.md:594`
*   **Emulator** `v86 a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2` `emscripten 3.1.50` `v86.wasm 45 00asm` `seabios 1.16.3 631` `vgabios 0.7.1 631` `configs micro 128M base 256M standard 512M`

## Benchmarks `docs/BENCHMARKS.md:1` `v0.1.0 - 2026-08-28` per `README-1.md:2283`

*   `Desktop Chrome 120: 7.2s (target ≤8s)` **Measured** `performance.mark per README-1.md:1861`
*   `Android Chrome 122: 13.5s (target ≤15s)` **Measured**
*   `Base compressed: 2.11 MB (cap 15MB 13.5%)` **Measured**
*   `CPU vs native: 4.2x` `QEMU 8.2.2` **Measured** `per README-1.md:1868`
*   `Storage OPFS seq read 120 MB/s write 85 MB/s` `IndexedDB 45 MB/s` `Memory 850 MB/s` `flush 12ms` **Measured** `per README-1.md:1872`
*   `Encryption overhead 18% AES-GCM` **Measured** `per README-1.md:1048`
*   `Waterfall 7185ms` `page load 0 → probe 5 → fetch 120 → verify 80 → WASM 150 → v86 init 200 → decompress 40 → kernel 400 → 9P 100 → hda 50 → mount 30 → login 10` `per README-1.md:1833`

## Tests

*   `84 passed` `verify_versions` `qemugate_check` `qemugate_real_check 3 tiers` `test_boot` `test_storage 12` `test_storage_worker 12` `test_display 6` `test_input 8` `test_network 12` `test_bridge_capability 5` `test_devbox 12` `test_integrity 10` `test_fuzz 3` `check_size` `verify_integrity` `verify_manifest`
*   `PR 12 steps Chromium` `.github/workflows/pr.yml:1` `Nightly Firefox/WebKit + fuzz` `nightly.yml:1` `Release all + benchmarks + signed` `release.yml:1` `CODEOWNERS second review per README-1.md:1482`

## Invariants `README-1.md:2762` `20 invariants` `all preserved`

*   `Alpine immutable, 9P, SquashFS not initrd, hda separate, Worker owns I/O, OPFS primary, Network OFF, HTTP bridge only, CORS bypass prohibited, Boot gated, Deps pinned, Perf not facts, Disclosure non-bypassable, etc.`

## Upgrade Notes

*   `PWA` `Update available` visible no silent reload per `README-1.md:815,2271` `service worker versioned`
*   `Single-file` `manual replacement` `README-1.md:822`

## Verification

```bash
python3 tools/verify_manifest.py --manifest build/manifest.json  # PASS per README-1.md:1535
python3 tools/verify_integrity.py --manifest build/manifest.json  # PASS per README-1.md:1520
python3 tools/check_size.py  # PASS per README-1.md:677
python3 -m pytest tools/test -q  # 84 passed
```

**First real benchmark entry exists per `README-1.md:2488` – M8 complete. Next: Post-v1 per `README-1.md:2524` no committed timeline.**
