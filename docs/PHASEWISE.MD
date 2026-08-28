# PHASEWISE.md - Phased Implementation Plan

> **Source of Truth:** `README-1.md` is canonical. Derived from `README-1.md:25 Milestones (M1-M8)`, `README-1.md:6 Build Order (Steps 1-9)`, `README-1.md:17 CI/CD`, `README-1.md:18 Performance`.

## 1. At-a-Glance Roadmap

```
M1 Kernel + minimal boot (native QEMU gate)
 → M2 Real root + hybrid storage + v86/WASM [HARD GATE]
   → M3 Display/Input
     → M4 Persistent filesystem (Worker/OPFS/IndexedDB/memory)
       → M5 DevBox validation (gcc/git/python3/vim/Node)
         → M6 HTTP/HTTPS egress bridge
           → M7 Security & CI (hashes, SBOM, fuzz, tiered CI)
             → M8 Release (PWA + single-file + signed manifest + benchmarks)
```

M2 is **hard gate** - if any of its 12 acceptance criteria fail, project not complete (`README-1.md:2314`).

## 2. Phase Mapping to Build Order & Structure

**Directory mapping** `README-1.md:412`:

*   M1: `src/kernel/` + `src/kernel/initramfs-minimal/`
*   M2: `src/rootfs/` + `src/emulator/config/` + `src/bridge/storage.js` + `src/main.js` + `build/`
*   M3: `src/bridge/display.js` + `src/bridge/input.js` + `src/ui/`
*   M4: Storage Worker (dedicated) + OPFS/IndexedDB/memory fallbacks
*   M5: `src/rootfs/overlay/` for tier manifests
*   M6: `src/bridge/network.js`
*   M7: `tools/` + `docs/BENCHMARKS.md` + CI
*   M8: `tools/pack.py` packaging + release signing

## 3. Phase 0 - Foundation (Pre-M1)

**Goal:** Establish reproducible scaffolding.

*   Create `versions.lock` with exact Linux 6.6.x, Alpine 3.19 digest, Emscripten, Node 20.x (`README-1.md:1474`).
*   Scaffold `Makefile`, `build.sh`, `requirements.txt`, `.gitmodules` for v86 pin (`README-1.md:152`).
*   Scaffold `tools/verify_versions.py`, `tools/serve.py` (with COOP/COEP `README-1.md:198`), `tools/pack.py` stubs.
*   Document invariants `README-1.md:2762`.

**Entry criteria:** Repo empty except `README-1.md:1`.
**Exit criteria:** `versions.lock` exists, build scripts skeleton passes `verify_versions.py`.

## 4. Phase 1 - Milestone 1: Kernel + Minimal Boot

**Source:** `README-1.md:2290`

**Goal:** `Linux 6.6 → linuxhtml_defconfig → BusyBox initramfs → native QEMU → shell`

**Steps** `README-1.md:494`:

1.  Step 1: `cd src/kernel && ./build.sh` → verifies tarball SHA → `src/kernel/bzImage` (`README-1.md:512`)
2.  Step 2: `cd src/kernel/initramfs-minimal && ./build.sh` → `initramfs-minimal.cpio` (`not product root` `README-1.md:533`)
3.  Step 3: QEMU gate `qemu-system-x86_64 -kernel bzImage -initrd cpio -nographic -m 256M` → shell prompt (`README-1.md:538`)

**Acceptance** `README-1.md:2306`:
*   kernel builds
*   minimal initramfs builds
*   QEMU boots
*   shell prompt appears

**Failure handling:** If fails, do not debug v86/WASM/OPFS - belongs to kernel/config or initramfs (`README-1.md:552`).

**Duration hint:** Requires Linux x86_64 + Docker 24.x+ + QEMU + 8GB RAM/10GB disk (`README-1.md:244`).

## 5. Phase 2 - Milestone 2: Real Root + Hybrid Storage + v86/WASM [HARD GATE]

**Source:** `README-1.md:2312` - **Most critical phase**

**Goal:** `Linux 6.6 + Alpine 3.19 + exact v86 commit + 9P immutable root + raw hda writable disk + storage Worker + browser boot`

**Steps:**

4.  Step 4: `cd src/rootfs && ./build.sh --tier base` → `build/rootfs-base.squashfs` (not initrd `README-1.md:573`) + `build/disk-base.img` raw disk `/home /root /opt` (`README-1.md:576`)
5.  Step 6: Native QEMU validation of real guest - must match final kernel cmdline + layout, test file creation + unmount/remount survival (`README-1.md:600`)
6.  Step 7: `cd src/emulator && ./build.sh` → v86 WASM via pinned Emscripten emsdk (`README-1.md:621`)
7.  Step 8: `python3 tools/pack.py --tier base --target pwa` → `build/pwa/` (`README-1.md:630`)
8.  Integrate `src/main.js` capability probe → verify → disclosure → `new V86(baseTierConfig).run()` with `autostart:false` (`README-1.md:1342`)

**Configuration contract** `README-1.md:1253`:
*   `filesystem: {baseurl: "/assets/rootfs-base/"}` → 9P root
*   `disk: {async:true, storage_bridge:true}` → hda
*   `bzimage`, `bios`, `vga_bios`, `wasm_path`
*   `root=host9p rootfstype=9p rootflags=trans=virtio` (`README-1.md:1328`)
*   Tier configs `micro.js/base.js/standard.js` vary only memory/rootfs/disk/packages/display (`README-1.md:1360`)

**12 Acceptance Criteria (all required) `README-1.md:2355`:**
1.  Alpine root available via 9P
2.  Root remains read-only
3.  `hda` detected as writable block device
4.  `/home` can be mounted on writable storage
5.  `/root` persisted per final mount/overlay design (TODO: finalize design `README-1.md:713`)
6.  `/opt` persisted per same
7.  File on writable disk survives reboot
8.  Export/import reproduces file
9.  Storage mediated by Worker
10. No SquashFS incorrectly passed as `-initrd`
11. Browser guest reaches shell prompt
12. Boot waterfall instrumented `performance.mark()`

**Exact combination proven** `README-1.md:2337`: Linux 6.6.x + Alpine 3.19.x + pinned v86 + 9P filesystem + host9p params + hda + browser/WASM.

## 6. Phase 3 - Milestone 3: Display/Input

**Source:** `README-1.md:2373`

```
v86 VGA → Canvas2D (dirty rectangles) + WebGL2 ?gpu=1
DOM keyboard/mouse/touch → input.js → PS/2
```

*   Use Canvas2D display.js with dirty-rect optimization (`README-1.md:1200`), resolution 1024x768 (`README-1.md:1242`)
*   WebGL2 experimental via flag (`README-1.md:1212`) - not passthrough
*   Touch includes on-screen trackpad, functional but not polished (`README-1.md:1236`)

**Acceptance:** terminal visible, keyboard works, mouse works, basic touch works.

## 7. Phase 4 - Milestone 4: Persistent Filesystem

**Source:** `README-1.md:2396`

```
hda → storage Worker → OPFS → IndexedDB → memory
```

*   Implement Disk API `open/read/write/flush/truncate/size/export/import/close` (`README-1.md:939`) with bounds/quotas/serialization
*   Atomic policy `write temp → flush → rename` (`README-1.md:1028`)
*   Backed hierarchy + non-dismissible memory warning (`README-1.md:910`)
*   Validate via `test_storage.py`: `open→write→flush→read→verify` + quota exhaustion reopen + `export→import→verify` (`README-1.md:1604`)

**Acceptance:** write/read/flush/persistence/quota/export/import/reopen all validated.

## 8. Phase 5 - Milestone 5: DevBox Validation

**Source:** `README-1.md:2421`

*   Base tier must verify: `gcc`, `git`, `python3`, `vim`
*   Standard additionally: `node` (assert not in Base `README-1.md:2438`)
*   Size budgets enforced: micro 8MB, base 15MB, standard 25MB, >5% fails CI (`README-1.md:677`)

## 9. Phase 6 - Milestone 6: HTTP/HTTPS Egress

**Source:** `README-1.md:2440`

```
guest TCP → network.js (SLIRP-style terminates TCP, extracts HTTP, issues fetch) → browser → response → guest TCP segments
```

*   Support: HTTP/HTTPS/browser methods/DNS via bridge resolver (`README-1.md:1128`)
*   Not: raw TCP/UDP/ICMP/ping/SSH/WebSocket/WebRTC/relay (`README-1.md:1136`)
*   CORS applies, no bypass (`README-1.md:1159`)
*   Default OFF, UI communicates enabled (`README-1.md:1174`)
*   No network-enabled build with root/no-password shipped (`README-1.md:1185`)

**Acceptance** `README-1.md:2455`: allowed HTTPS works, CORS failure visible, unsupported clean failure, network off by default.

*Tests* `README-1.md:1672`: `guest curl → endpoint success` + `non-HTTP → clean failure`.

## 10. Phase 7 - Milestone 7: Security and CI [Parallel Track]

**Source:** `README-1.md:2462`

**Security:**
*   SHA-256 verify wasm/kernel/rootfs/BIOS/seed before boot via Web Crypto (`README-1.md:1486`), `verifyIntegrity()` example (`README-1.md:1501`)
*   Release `manifest.json` + `.sig` signed (`README-1.md:1522`)
*   SBOM for rootfs (`README-1.md:1480`)
*   Tamper test: modify one byte → boot rejected (`README-1.md:1540`)
*   First-run disclosure non-bypassable (`README-1.md:745`)
*   Supply chain pinning + SBOM + second reviewer (`README-1.md:1474`)
*   Fuzz harness for VirtIO block/VGA/UART nightly (`README-1.md:1712`), not exhaustive

**CI/CD Tiered** `README-1.md:1726`:

*   **Every PR (blocking) `README-1.md:1730`:** deps verify → kernel build → minimal QEMU → rootfs build → real QEMU → WASM build → PWA → single-file → size check → Chromium smoke (`test_boot.py`) → storage/disk API (`test_storage.py`) → egress (`test_network.py`)
*   **Nightly `README-1.md:1749`:** Firefox suite + WebKit suite + full cross-browser (`test_cross_browser.py`) + fuzz + extended storage/network
*   **Release `README-1.md:1760`:** all PR + all browsers + full tests + fuzz review + benchmark suite + manifest generation/signature + PWA + single-file + publication

Flow diagram `README-1.md:1780`: PR → core+Chromium → merge → nightly Firefox/WebKit/fuzz → release all+benchmarks→ signed artifacts.

## 11. Phase 8 - Milestone 8: Release

**Source:** `README-1.md:2478`

*   PWA `build/pwa/` + single-file `build/linuxhtml.html` (base64 ~33% overhead `README-1.md:797`)
*   Signed manifest + benchmark entry + release notes (`README-1.md:2248`)
*   Versioning `vMAJOR.MINOR.PATCH` (`README-1.md:2242`), Linux 6.6.x pinned tracked (`README-1.md:2258`)
*   No silent PWA updates - "Update available" visible (`README-1.md:2271`), cache versioned (`README-1.md:815`)
*   **Not complete until first real benchmark entry exists** (`README-1.md:2488`) in `docs/BENCHMARKS.md`

## 12. Performance Gating Across Phases (`README-1.md:1815`)

*   Waterfall must be measured at each phase via `performance.mark/measure`: page load → probe → fetch → verify → instantiate → init → decompress → boot → 9P → hda → mount → login (`README-1.md:1833`)
*   Targets until measured: Desktop ≤8s, Android ≤15s, Base ≤15MB, CPU/storage/encryption pending baseline (`README-1.md:1820`)
*   Need QEMU vs browser CPU baseline (`README-1.md:1868`), storage separate benches sequential/random read/write/flush for each backend (`README-1.md:1872`)
*   Correct wording: "target boot time ≤8 seconds" not "boots in 8 seconds" (`README-1.md:1895`)

## 13. Browser Compatibility Progression (`README-1.md:1903`)

| Phase | Chrome/Edge 120+ | Firefox 122+ | Safari 17+ | Android |
|-------|------------------|--------------|------------|---------|
| M1-M2 | Reference QEMU + Chromium smoke | - | - | - |
| M3-M4 | Full OPFS Worker | - | - | - |
| M7 Nightly | Pass PR gate | Validate | Validate | ≤15s target |
| M8 Release | All 3 + benchmarks | All 3 + benchmarks | All 3 + benchmarks | Device-dependent |

Capability-driven checks: SAB, COI, OPFS, sync handles, memory limits (`README-1.md:1926`).

## 14. Dependency Order Summary

```
versions.lock → kernel → initramfs → QEMU gate → rootfs → disk → QEMU real → v86 → pack → verify → display/input → storage Worker → devbox packages → network bridge → security/CI/fuzz → release + benchmarks
```

Invariant guard (`README-1.md:2762`): Never casually change - immutable 9P, separate hda, Worker-owned I/O, OPFS primary, network off & HTTP/HTTPS only, CORS bypass prohibited, boot blocked until integrity, all deps pinned, disclosure non-bypassable, etc.

## 15. Phase 9 – Post-v1 Kickoff (2026-08-28) `FUTURE-SCOPE.MD:11`

**Goal:** After `v0.1.0` validated `7.2s/13.5s/2.11MB` `84 tests` `20 invariants` per `README-1.md:2522`, begin flagged stubs for post-v1.

*   `src/bridge/websocket.js:1` `WebSocketBridge ?websocket=1` `disabled by default per README-1.md:1146` `ws:// wss://` `connect/send/close` `mock WebSocket`
*   `src/bridge/network.js:1` `8432→8432` `Phase 9 note WebSocket relay behind flag` `v1 per README-1.md:1146 unsupported`
*   `tools/lint.sh:1` `eslint/node --check shellcheck` `tools/devbox.sh:1` `--tier --hot-reload` `richer tooling per FUTURE-SCOPE.MD:3`
*   `tools/maintenance/kernel_eol_check.py:1` `Linux 6.6 LTS EOL 2026-12-01 remaining 95 days per README-1.md:2267`
*   Tests: `tools/test/test_phase9.py:1` `8 tests` `websocket feature-flagged, tooling, kernel EOL, no regression v1` `92 passed total`
*   Docs: `docs/FUTURE-SCOPE.MD:11` Phase 9 Started

## 16. Future Phases (Post-v1) - Gated

Only after v1 validated by usage (`README-1.md:2522`): WebRTC, WebGPU, multi-VM, additional profiles, RISC-V/TinyEMU, improved mobile input, stronger encryption, richer tooling (`README-1.md:2524`). WebSocket relay now stubbed in Phase 9. No committed timeline (`README-1.md:2536`).

## 16. References

*   `README-1.md:6` Build Order & Instructions
*   `README-1.md:17` CI/CD Pipeline
*   `README-1.md:25` Implementation Milestones (M1-M8)
*   `README-1.md:26` Roadmap
*   `README-1.md:28` Architecture Invariants & Definition of Done
