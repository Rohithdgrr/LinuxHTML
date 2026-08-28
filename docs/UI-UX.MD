# UI-UX.md - Display, Input & User Experience

> **Source of Truth:** `README-1.md` is canonical. Derived from `README-1.md:4.1`, `README-1.md:8.1`, `README-1.md:9`, `README-1.md:12`, `README-1.md:14.4`, `README-1.md:19`.

Note: Requested as `UI/UX.MD` - created as `UI-UX.MD` and `UI/UX.MD` for filesystem compatibility. Both contain identical content.

## 1. Overview

LinuxHTML UI is entirely browser-native: Canvas for display, DOM events for input, no native windowing. Focus is reproducible sandbox UX, not desktop replacement (`README-1.md:28`).

High-level placement (`README-1.md:301`):

```
main.js → capability probe → verify → disclosure → v86 → {display.js → Canvas, input.js → PS/2, network.js → fetch}
```

## 2. Display

### 2.1 Default - Canvas2D (`README-1.md:1193`)

*   Rendering via Canvas2D with **dirty-rectangle updates** - should not redraw entire frame when only small region changed (`README-1.md:1202`).
*   Configurable resolution; default target **1024 × 768** (`README-1.md:1242`), tier-configurable via `src/emulator/config/*.js`.
*   Optimized for small immutable base/fast startup (`README-1.md:374`).

### 2.2 Experimental - WebGL2 (`README-1.md:1205`)

*   Enabled through explicit feature flag such as `?gpu=1` (`README-1.md:1214`).
*   **Important:** Not GPU passthrough / not virtio-gpu (`README-1.md:1217`, `README-1.md:1940`). Clarify in UI to avoid "GPU compute" expectation.
*   Experimental path - keep Canvas2D as default for v1.

### 2.3 SMP & Deployment Impact on Display (`README-1.md:803`)

| Distribution | SMP | Display Consequence |
|--------------|-----|---------------------|
| PWA with COOP/COEP | Yes where permitted | Multi-core rendering possible where browser allows |
| Single-file `file://` | No | Single-core, platform constraint not bug (`README-1.md:811`) |
| Safari/WebKit | No | Fallback to single-core Canvas2D |

Requires PWA served with `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` (`README-1.md:198`) for cross-origin isolation.

## 3. Input

### 3.1 Translation Pipeline (`README-1.md:1221`)

```
Keyboard → input.js → PS/2/device emulation → Linux
Mouse    →
Touch    →
```

DOM events translated to emulated device input via PS/2 (`README-1.md:1230`).

### 3.2 Keyboard

*   DOM keyboard events → v86 PS/2.
*   Must handle layout-agnostic key codes; tested via `test_cross_browser.py` (`README-1.md:1694`).

### 3.3 Mouse

*   DOM mouse events → emulated PS/2 mouse.
*   Canvas coordinate mapping with scaling for 1024x768 → device pixels.

### 3.4 Touch (`README-1.md:1236`)

*   Includes basic **on-screen trackpad-style control**.
*   Functional but **not polished in v1** (`README-1.md:1238`) - documented limitation (`README-1.md:1953`).
*   Mobile validation via current Android Chrome (`README-1.md:289`); Safari iOS partial with tighter memory/tab eviction (`README-1.md:1917`).

### 3.5 Resolution Interaction

Tier configs vary display defaults (`README-1.md:1362`), e.g., micro may use smaller frame.

## 4. First-Run Disclosure & Security UX (`README-1.md:745`, `README-1.md:1441`)

*   **Content:** Explains app executes arbitrary guest code via WASM, users should only load builds from trusted sources (`README-1.md:747`, `README-1.md:1443`).
*   **Non-bypassable:** Cannot be bypassed by query param, config flag, hidden UI, alternate code path (`README-1.md:750`, `README-1.md:1448`, invariant `README-1.md:2762:16`).
*   ** placement:** After integrity verification, before `emulator.run()` (`README-1.md:206`).

## 5. Storage UX

*   **Hierarchy feedback:** OPFS primary; if unavailable, IndexedDB; if both fail, memory with **persistent, non-dismissible warning** that data will be lost on tab close (`README-1.md:910`).
*   **Warning trigger:** Check OPFS availability + private-browsing restrictions (`README-1.md:2052`).
*   **Export/Import UX:**

```
Settings → Export disk → .img download
Settings → Import disk ← .img (validates type/format/version/size/integrity `README-1.md:1012`)
```

*   **No cloud sync v1** (`README-1.md:1052`); local only.

## 6. Network UX

*   **Default OFF** (`README-1.md:1174`); UI must clearly communicate when networking is enabled (`README-1.md:1183`).
*   **When enabled:** Visible indicator; only HTTP/HTTPS egress bridge (`README-1.md:1073`); failures visible (CORS failure, unsupported protocol clean failure `README-1.md:1687`).
*   **Not a general internet indicator:** Clarify HTTP/HTTPS only, not raw TCP/UDP/ICMP.

## 7. PWA & Update UX (`README-1.md:760`)

### 7.1 PWA Primary

```
index.html → assets/{v86.wasm, kernel, rootfs, BIOS} → service worker
```

*   Requires static hosting with header control + COOP/COEP for SMP (`README-1.md:778`).
*   Update: service-worker cache versioned, shows **"Update available"** visibly, does **not** silently reload onto new version (`README-1.md:815`). Invariant `README-1.md:2762:15` performance numbers not facts until measured, but update UX is not silent (`README-1.md:2271`).

### 7.2 Single-File

*   `build/linuxhtml.html` secondary offline/demo (`README-1.md:788`); manual replacement updates (`README-1.md:822`); no SMP.

## 8. Terminal & Shell UX

*   **Structure:** `src/ui/terminal/`, `statusbar/`, `firstrun/` (`README-1.md:452`).
*   **Boot:** Page shows boot splash; on success reaches **shell prompt / login prompt** (`README-1.md:1589`, `README-1.md:2369`).
*   **Credentials:** `root` no password in dev (`README-1.md:230`); do not expose network-enabled build with defaults (`README-1.md:235`). Future network builds need password-protected user (`README-1.md:1435`).
*   **Status bar:** Should show capability, storage backend active (OPFS/IndexedDB/memory warning), network on/off, integrity status.

## 9. Browser Compatibility UX Matrix (`README-1.md:1903`)

| Browser | Boot | Storage | SMP | UX Notes |
|---------|------|---------|-----|----------|
| Chrome/Edge 120+ | Yes | OPFS | Yes PWA+COOP/COEP | Reference platform |
| Firefox 122+ | Yes | OPFS or IndexedDB | Capability-dependent | Nightly validation |
| Safari macOS 17+ | Yes | IndexedDB fallback | No | OPFS sync may vary |
| Safari iOS | Partial | IndexedDB | No | Tighter memory, tab eviction |
| Chrome Android | Yes | OPFS where available | Device-dependent | ≤15s boot target |

Capability-based detection, not UA-only (`README-1.md:292`); must detect SharedArrayBuffer, cross-origin isolation, OPFS sync handles, memory limits (`README-1.md:1926`) and select fallback rather than failing silently (`README-1.md:1933`).

## 10. Performance UX

*   **Targets:** Desktop Chrome ≤8s, Android ≤15s (targets until `docs/BENCHMARKS.md` `README-1.md:1820`).
*   **Correct wording before measurement:** "target boot time of ≤8 seconds" not "boots in 8 seconds" (`README-1.md:1895`).
*   **Waterfall instrumentation:** `performance.mark/measure` at each stage (`README-1.md:1861`) to power UX loading indicators: `page load → probe → fetch → verify → instantiate → init → decompress → boot → 9P → hda → mount → login`.

## 11. Extension & Customization UX (`README-1.md:2138`)

*   Downstream projects create `examples/<your-project>/` with `profile.json` defining tier, rootfs overlay, boot args, UI customization, branding, terminal defaults (`README-1.md:2156`).
*   Do not fork `src/`; extend via profile+overlay+bridge (`README-1.md:2164`).
*   Example profile includes `ui.terminal_theme` (`README-1.md:2198`).

## 12. Error & Troubleshooting UX (`README-1.md:1966`)

UX must surface clear errors for:

*   Blank page/no splash → hint to use `tools/serve.py` for headers (`README-1.md:1968`).
*   `SharedArrayBuffer is not defined` → COOP/COEP missing (`README-1.md:1985`).
*   Boot freeze after verify → check DevTools console for fetch/CORS/hash/manifest/WASM (`README-1.md:2001`).
*   Storage warning every load → explain fallback, persistence lost in memory mode (`README-1.md:2052`).
*   Export/import fail → validate .img format/version/size (`README-1.md:2066`).
*   `curl` resolve/HTTPS fail → network enabled? CORS? bridge logs (`README-1.md:2077`).

Design for **deterministic, visible failures** not silent success (`README-1.md:1691`).

## 13. Design Principles

*   Single-user, offline-first, reproducible, security-conscious (`README-1.md:13`).
*   Small, testable v1 over premature features (`README-1.md:2851`).
*   Always show capability/Storage/Network state; never silently degrade.
*   Keep disclosure, integrity, and update prompts explicit and non-dismissible where required.

## 14. References

*   `README-1.md:12` Display & Input
*   `README-1.md:8.1` First-run disclosure
*   `README-1.md:9` Deployment PWA vs Single-File
*   `README-1.md:10.3` Storage Backend Hierarchy
*   `README-1.md:14.4` First-run disclosure (Security)
*   `README-1.md:19` Browser Compatibility
*   `README-1.md:21` Troubleshooting
