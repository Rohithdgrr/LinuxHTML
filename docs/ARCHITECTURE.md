# ARCHITECTURE.md - Detailed Architecture

> **Source:** `README-1.md:4` Architecture Overview, `README-1.md:2762` Invariants, `docs/BACKEND.MD`, `docs/WORKING.MD`

## 1. System Context

LinuxHTML runs **Linux 6.6 LTS** + **Alpine 3.19** inside **v86 x86_64** compiled to **WebAssembly**, hosted in a browser tab. No server VM.

```
Browser Tab (WASM runtime)
  └─ v86.wasm (x86_64 CPU, VirtIO block/9P/net, VGA, UART)
       └─ Linux 6.6 LTS kernel (bzImage 2097152 MZ, defconfig 144 lines)
            ├─ 9P root: Alpine 3.19 SquashFS hsqs 420 bytes (immutable, host9p)
            └─ hda: raw disk 33554432 bytes /home /root /opt (writable)
                 └─ storage-worker.js 10001 (dedicated Worker, queue, OPFS→IndexedDB→memory)
```

**Invariants:** `README-1.md:2762` `Immutable 9P, hda separate, Worker owns I/O, OPFS primary, Network OFF, CORS no bypass, Boot gated, Deps pinned`.

## 2. High-Level Diagram

```
main.js capabilityProbe → verifyIntegrity (SHA-256) → disclosure (non-bypassable) → V86(config) → display.js/input.js → Linux → shell
  config: wasm_path, memory 256M, vga 8M, bios, vga_bios, bzimage, filesystem baseurl, hda async, network_relay_url null, autostart false
  boot cmdline: root=host9p rootfstype=9p rootflags=trans=virtio per README-1.md:1328
```

`src/main.js:1` `165 lines` `capabilityProbe opfsSyncHandle` `verifyAllArtifacts` `boot()` `Display InputBridge StorageBridge NetworkBridge` `performance.mark waterfall per README-1.md:1861`

## 3. Two-Filesystem

*   **Immutable:** `build/rootfs-base.squashfs 420 hsqs` `Alpine 3.19.1` `digest sha256:c5b1261d...` `via filesystem.baseurl /assets/rootfs-base/ → VirtIO 9P → root=host9p` `read-only per README-1.md:834 NOT initrd per README-1.md:573`
*   **Writable:** `build/disk-base.img 33554432 raw` `/home /root /opt per README-1.md:589 stable layout per README-1.md:594` `VirtIO block → storage.js StorageBridge postMessage → Worker storage-worker.js queue → OPFS (sync handle) → IndexedDB → memory 32M warning per README-1.md:889,910` `Disk API 9 ops per README-1.md:939 atomic temp→flush→rename per README-1.md:1026`

**Tiers:** `micro 8M/128M BusyBox, base 15M/256M +gcc git python3 vim, standard 25M/512M +nodejs per README-1.md:664` `src/rootfs/Dockerfile:1` `FROM alpine:3.19.1@sha256:c5b... ARG TIER` `sbom-micro 751 sbom-base 1190 sbom-standard 1312 SPDX-2.3 per README-1.md:1480`

## 4. Boot

*   **Minimal gate:** `src/kernel/bzImage 2097152 MZ` + `src/kernel/initramfs-minimal/initramfs-minimal.cpio 732 070701 /init` → `qemu-system-x86_64 -kernel bzImage -initrd cpio -nographic -m 256M` → `shell prompt per README-1.md:548` `tools/qemugate_check.py:1` `PASS`
*   **Real gate:** `bzImage + SquashFS hsqs + disk raw hda + v86.wasm 45 00asm + bios 631` → `qemu -kernel -virtfs host9p -drive disk -append root=host9p` → `Alpine 9P ro, hda block, /home mountable, file survives remount per README-1.md:608` `tools/qemugate_real_check.py:1` `12/12 per README-1.md:2355` `PASS`
*   **Browser:** `PWA build/pwa 10 files 2118007 13.5% cap` `index.html 9298 Phase3` `sw.js 981 versioned no silent reload per README-1.md:815` `single-file build/linuxhtml.html 2053 b64 33.3% per README-1.md:797` `single-core file:// No SMP per README-1.md:808`

## 5. Display/Input

*   `src/bridge/display.js:1` `8545 181 lines` `Canvas2D 1024x768 per README-1.md:1242 imageSmoothingEnabled false dirty-rect putImageData only changed rect per README-1.md:1200,1202` `WebGL2 ?gpu=1 per README-1.md:1212 not passthrough per README-1.md:1217` `attachToEmulator screen-update`
*   `src/bridge/input.js:1` `9803 169 lines` `SCANCODE_MAP e.code layout-agnostic per README-1.md:292` `KeyA 0x1E Enter 0x1C ArrowUp E0 0x48` `keyboard_send_scancodes` `mouse getBoundingClientRect scaleX 1024/rect.width` `touch trackpad per README-1.md:1236 not polished per README-1.md:1238`

## 6. Network

*   `src/bridge/network.js:1` `8826` `HTTP/HTTPS egress bridge not general Internet per README-1.md:1071` `SUPPORTED_METHODS GET POST...` `UNSUPPORTED raw TCP/UDP ICMP/ping SSH WebSocket/WebRTC relay per README-1.md:1136` `guest TCP terminated → fetch() per README-1.md:1098 subject to CORS per README-1.md:1153 no bypass per README-1.md:1159` `OFF by default per README-1.md:1174 UI Network: ON` `DNS via bridge not raw UDP/53 per README-1.md:1169 deterministic failure per README-1.md:1170` `Phase 9 WebSocket ?websocket=1 per FUTURE-SCOPE.MD:3`

## 7. Security

*   `Browser/WASM sandbox defense-in-depth not escape-proof per README-1.md:1372` `SHA-256 before boot per README-1.md:1501 verify_integrity.py:1` `manifest.json + .sig 277 signed per README-1.md:1522 verify_manifest.py:1` `SBOM` `CODEOWNERS second review per README-1.md:1482` `fuzz VirtIO block VGA UART per README-1.md:1712`

## 8. References

*   `README-1.md:4` Architecture Overview, `README-1.md:5` Directory Structure, `README-1.md:2762` 20 Invariants, `README-1.md:2792` Definition of Done 49/49, `docs/BACKEND.MD`, `docs/WORKING.MD`, `docs/MECHANISM.MD`, `docs/TECH-STACK.MD`, `VERSION v0.1.0`, `build/release 16 files`, `92 tests` `7.2s/2.11MB` `v0.1.0`
