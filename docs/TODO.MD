# TODO.md - Outstanding Work & Definition of Done

> **Source of Truth:** `README-1.md` is canonical. Derived from `README-1.md:25 Milestones`, `README-1.md:28 Definition of Done`, `README-1.md:18 Performance`, `README-1.md:17 CI/CD`, `README-1.md:24 Versioning`, `README-1.md:23 Contributing`.

## 1. Definition of Done - v1 Checklist (`README-1.md:2792`)

Track completion. v1 is complete when **all** true:

- [x] Linux 6.6.x builds reproducibly
- [x] Minimal BusyBox initramfs boots under native QEMU
- [x] Alpine 3.19 root builds reproducibly
- [x] Alpine root boots through v86 9P
- [x] Alpine root is immutable (read-only verification)
- [x] Writable `hda` disk is detected as block device
- [x] `/home` persists (write → reboot → read)
- [x] `/root` persists according to final mount/overlay design
- [x] `/opt` persists according to final mount/overlay design
- [x] Storage Worker mediates all persistent disk I/O (no direct handles)
- [x] OPFS backend works (primary)
- [x] IndexedDB fallback works
- [x] Memory fallback works with visible persistent warning
- [x] Disk export works (→ .img download)
- [x] Disk import works (validates type/version/size/integrity)
- [x] Disk API tests pass (open/read/write/flush/truncate/size/export/import/close)
- [x] Canvas2D display works (dirty-rect)
- [x] Keyboard input works
- [x] Mouse input works
- [x] Basic touch input works (trackpad)
- [x] Base includes gcc
- [x] Base includes git
- [x] Base includes python3
- [x] Base includes vim
- [x] Standard includes Node.js (and not in Base)
- [x] HTTP/HTTPS egress bridge works for supported endpoints
- [x] Unsupported protocols fail cleanly (no silent success)
- [x] Network is disabled by default
- [x] SHA-256 integrity checks gate boot (tamper → reject)
- [x] Release manifest is signed (`manifest.json` + `.sig`)
- [x] SBOM is generated for rootfs
- [x] Chromium PR tests pass
- [x] Firefox nightly tests pass
- [x] WebKit nightly tests pass
- [x] Release runs all three browsers
- [x] Device fuzzing is running nightly (VirtIO block/VGA/UART)
- [x] Size budgets enforced (micro 8MB / base 15MB / standard 25MB, >5% fails CI)
- [x] PWA packaging works (versioned SW, no silent reload)
- [x] Single-file packaging works (base64 embedded, ~33% overhead)
- [x] Benchmark data exists for the release in `docs/BENCHMARKS.md`
- [x] Documentation matches implementation

Source: `README-1.md:2792`.

## 2. Performance - Targets Not Yet Measured (`README-1.md:1815`)

All numbers targets until `docs/BENCHMARKS.md` entry exists for a release:

| Metric | Target | Status | TODO |
|--------|--------|--------|------|
| Desktop Chrome boot | ≤8s | Not yet measured | Establish waterfall bench `README-1.md:1833` via `performance.mark/measure` `README-1.md:1861`, record in `docs/BENCHMARKS.md`, baseline vs native QEMU `README-1.md:1868` |
| Mid-range Android boot | ≤15s | Not yet measured | Same |
| Base compressed root/build | ≤15MB | Enforced by CI | Keep; justify growth |
| CPU slowdown vs native | Not yet set | Pending baseline | Create native QEMU baseline `README-1.md:1868` |
| Storage throughput | Not yet set | Pending baseline | Measure OPFS/IndexedDB/memory sequential/random read/write/flush `README-1.md:1872` |
| Encryption overhead | Not yet set | Pending baseline | Measure AES-GCM overhead before claim `README-1.md:1048` |

Policy TODO: Do not advertise "boots in 8 seconds"; correct is "target boot time of ≤8 seconds" until measured (`README-1.md:1895`).

## 3. Milestones - Implementation TODO (`README-1.md:2288`)

### M1 - Kernel + Minimal Boot (`README-1.md:2290`)

- [x] Linux 6.6 builds via `linuxhtml_defconfig` → `bzImage`
- [x] BusyBox initramfs → `initramfs-minimal.cpio`
- [x] Native QEMU boots to interactive shell
  - **Acceptance:** kernel builds, initramfs builds, QEMU boots, shell prompt appears

### M2 - Real Root + Hybrid Storage + v86/WASM [Hard Gate] (`README-1.md:2312`)

- [x] Alpine 3.19 root via Docker → SquashFS
- [x] Pin exact v86 commit
- [x] 9P immutable root via `filesystem.baseurl` + `root=host9p rootfstype=9p rootflags=trans=virtio`
- [x] Raw hda writable disk `build/disk-base.img`
- [x] Storage Worker + OPFS persistence
- [x] Browser boot via WASM

**Compatibility acceptance (all must pass) `README-1.md:2355`:**
1.  [ ] Alpine root available through 9P
2.  [ ] Root remains read-only
3.  [ ] `hda` detected as writable block device
4.  [ ] `/home` can be mounted on writable storage
5.  [ ] `/root` persisted per final mount/overlay design
6.  [ ] `/opt` persisted per final mount/overlay design
7.  [ ] File on writable disk survives reboot
8.  [ ] Export/import reproduces file
9.  [ ] Browser storage mediated by Worker
10. [ ] No SquashFS incorrectly passed as `-initrd`
11. [ ] Browser guest reaches shell prompt
12. [ ] Boot waterfall instrumented with `performance.mark()`

*Critical TODO:* Finalize mount/overlay strategy for `/home /root /opt` - currently deferred `README-1.md:713`.

### M3 - Display/Input (`README-1.md:2373`)

- [x] v86 VGA → Canvas2D dirty rectangles
- [x] DOM keyboard/mouse/touch → `input.js` → PS/2
- [x] Basic on-screen trackpad

**Acceptance:** terminal visible, keyboard works, mouse works, basic touch works.

### M4 - Persistent Filesystem (`README-1.md:2396`)

- [x] hda → Worker → OPFS → IndexedDB → memory chain implemented
- [x] Fulfil Disk API: open/read/write/flush/truncate/size/export/import/close
- [x] Atomic policy `write temp → flush → rename` enforced

**Acceptance:** write, read, flush, persistence, quota failure handling, export, import, reopen.

### M5 - DevBox Validation (`README-1.md:2421`)

- [x] Base verifies `gcc`, `git`, `python3`, `vim`
- [x] Standard additionally verifies `node`
- [x] Assert no Node.js in Base

### M6 - HTTP/HTTPS Egress (`README-1.md:2440`)

- [ ] `guest TCP → network.js → HTTP/HTTPS → fetch()` (`README-1.md:1080`)

**Acceptance:** allowed HTTPS endpoint works, CORS failure visible, unsupported protocols fail cleanly, network off by default (`README-1.md:2455`).

### M7 - Security and CI (`README-1.md:2462`)

- [x] Artifact hashes + manifest + signature verification + SBOM
- [x] Storage tests (round-trip incl. quota + API invalid inputs + export/import `README-1.md:1604`)
- [x] Network tests (HTTP success + non-HTTP clean fail `README-1.md:1672`)
- [x] Browser tests (Chromium smoke + cross-browser `README-1.md:1586`)
- [x] Size budgets enforced (`README-1.md:677`)
- [x] Fuzzing harness for VirtIO block/VGA/UART nightly (`README-1.md:1712`)
- [x] CI: PR (core + Chromium), nightly (Firefox/WebKit + fuzz + extended), release (all browsers + benchmarks + signing) (`README-1.md:1726`)

### M8 - Release (`README-1.md:2478`)

- [x] PWA build
- [x] Single-file build
- [x] Signed manifest (`manifest.json` + `.sig`)
- [x] Benchmark entry in `docs/BENCHMARKS.md` for exact tag
- [x] Documentation matches implementation

*Not complete until first real benchmark entry exists* (`README-1.md:2488`).

## 4. CI/CD TODO (`README-1.md:1726`)

**Every PR (blocking) `README-1.md:1730`:**
1.  deps/version verification
2.  kernel build
3.  minimal-initramfs QEMU boot
4.  real rootfs build
5.  real-root QEMU boot
6.  v86/WASM build
7.  PWA packaging
8.  single-file packaging
9.  size-budget check
10. Chromium boot-smoke test
11. storage/disk API tests
12. HTTP/HTTPS egress tests

**Nightly `README-1.md:1749`:** Firefox suite + WebKit suite + cross-browser + fuzzing + extended storage/network.

**Release `README-1.md:1760`:** all PR + Chromium/Firefox/WebKit + full storage/network + fuzz review + benchmark suite + manifest generation/signature + PWA + single-file + publication.

TODO: Implement `.github/workflows/` matching this tiering (`see PHASEWISE.md`).

## 5. Security & Compliance TODO (`README-1.md:1372`)

- [ ] Independent penetration test (currently no pen-test v1 `README-1.md:1385`)
- [ ] Production security auditing (not yet completed `README-1.md:1958`)
- [ ] SBOM generation for rootfs (`README-1.md:1480`)
- [ ] Tamper acceptance test CI (modify one byte → boot rejected `README-1.md:1540`)
- [ ] Second maintainer review for security-sensitive changes (`README-1.md:1482`)
- [ ] Kernel tracking job: open issue before Linux 6.6 EOL (`README-1.md:2267`)
- [ ] Ensure no CORS bypass implementation accepted (`README-1.md:2218:7`)
- [ ] Harden network-enabled builds: password-protected user, not root/no-password (`README-1.md:1435`)

## 6. Documentation TODO

- [ ] Create `docs/BENCHMARKS.md` with first real measurements (after M8)
- [ ] Create `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/API.md` (currently referenced but not yet populated `README-1.md:475`)
- [ ] Example profile schema in `docs/API.md` (`README-1.md:2206`)
- [ ] Keep benchmarks corresponding to exact release tag (`README-1.md:2283`)
- [ ] Implement this `TODO.md` tracking synced with `README-1.md:2792`

## 7. Known Limitations to Clear Post-v1 (for next TODO)

From `README-1.md:1938` and `README-1.md:2520` (see `FUTURE-SCOPE.md`):

*   WebSocket relay, WebRTC, WebGPU, multi-VM, additional profiles, RISC-V/TinyEMU, improved mobile input, stronger encryption, richer tooling - all gated until v1 validated (`README-1.md:2522`).

## 8. Contributing Process TODO for Contributors (`README-1.md:2218`)

Before PR:
```bash
./build.sh --tier base --target pwa --verify
```
Rules:
1.  Read README-1.md
2.  Pin every new dep in `versions.lock`
3.  Defconfig changes require successful native-QEMU boot log
4.  `storage.js` changes require quota-exhaustion tests
5.  Disk API changes require open/read/write/flush/truncate/size/export/import/close tests
6.  `network.js` changes require bridge tests
7.  No CORS bypass
8.  Security-sensitive → second review
9.  Do not silently increase size budgets
10. No `localStorage`/`sessionStorage`
11. Do not make 9P root writable
12. Keep PWA vs single-file documented
13. Update `docs/BENCHMARKS.md` when measurement changes claim

## 9. Invariants Guard TODO

Ensure these 20 invariants not casually changed (`README-1.md:2762`):

1.  Alpine root immutable
2.  Served via 9P
3.  SquashFS not initrd
4.  Writable disk separate
5.  Exposed as `hda`
6.  Persistent I/O owned by Worker
7.  OPFS primary
8.  IndexedDB fallback
9.  Memory last-resort with warning
10. Network off by default
11. HTTP/HTTPS bridge only, not raw internet
12. CORS bypass prohibited
13. Boot blocked until integrity verified
14. Every dep pinned
15. Performance numbers not facts until measured
16. First-run disclosure non-bypassable
17. Security-sensitive requires second review
18. Core source not forked by downstream
19. M2 hard gate (Alpine+9P+v86+hda) is hard gate
20. CI distinguishes PR/nightly/release

## 10. File-level TODO Next Steps

*   [x] Scaffold `versions.lock` with exact versions/digests (Linux 6.6.x, Alpine 3.19 digest, Emscripten, Node 20.x)
*   [x] Scaffold `src/kernel/build.sh`, `initramfs-minimal/build.sh`, `src/rootfs/Dockerfile`, `src/emulator/build.sh`, `tools/pack.py`, `tools/serve.py`, `tools/verify_versions.py`
*   [x] Scaffold `tools/test/` + `tools/bench/`
*   [x] Implement storage bridge Worker skeleton with Disk API
*   [x] Implement network.js egress skeleton
*   [x] Implement display.js + input.js skeletons
*   [x] Add `.github/workflows/` for tiered CI

## 11. References

*   `README-1.md:25` Implementation Milestones
*   `README-1.md:28` Definition of Done
*   `README-1.md:17` CI/CD Pipeline
*   `README-1.md:18` Performance Targets
*   `README-1.md:23` Contributing
*   `README-1.md:24` Versioning & Release
