# FUTURE-SCOPE.md - Roadmap & Future Scope

> **Source of Truth:** `README-1.md` is canonical. Derived from `README-1.md:1.3`, `README-1.md:20`, `README-1.md:26`, `README-1.md:28`, `README-1.md:18`.

## 1. Philosophy - Expand Only After v1 Validation

Architecture deliberately favors small, testable v1 over premature multi-VM, GPU, RISC-V, WebRTC, WebSocket-relay, cloud infrastructure (`README-1.md:2851`). Project should expand only after v1 validated by real builds, benchmarks, tests, usage data (`README-1.md:2855`).

## 2. v1 Scope - Current Target (`README-1.md:2494`)

**Included in v1:**

*   Micro / Base / Standard tiers (`README-1.md:2499`)
*   DevBox example (`README-1.md:2502`)
*   Immutable 9P root + writable `hda` disk (`README-1.md:2503`)
*   OPFS persistence + IndexedDB fallback + in-memory fallback + export/import (`README-1.md:2505`)
*   Canvas2D + experimental WebGL2 (`README-1.md:2509`)
*   Keyboard/mouse/touch input (`README-1.md:2511`)
*   HTTP/HTTPS egress bridge (off by default) (`README-1.md:2512`)
*   Integrity verification (SHA-256 + signed manifest) (`README-1.md:2513`)
*   CI (PR/nightly/release) + fuzzing (`README-1.md:2514`)
*   PWA + single-file build + benchmark reporting (`README-1.md:2516`)

**v1 Is (`README-1.md:122`):**

*   Single-user dev sandbox, one VM per tab, x86_64 only, Linux only, primarily offline/local, network-disabled by default, small number of deliberately supported devices.

**v1 Is NOT (`README-1.md:134`):**

*   GPU compute, multi-tenant cloud, multi-VM orchestrator, general raw TCP/UDP networking, RISC-V emulator, production security boundary, replacement for native Linux.

## 3. Post-v1 Potential Areas (`README-1.md:2520`)

Only after real v1 usage validates core architecture. **No committed timeline** (`README-1.md:2536`).

*   **WebSocket relay** - beyond HTTP/HTTPS, requires new bridge + security review (currently explicitly unsupported `README-1.md:1146`).
*   **WebRTC networking** - P2P, currently unsupported `README-1.md:1147`.
*   **WebGPU research** - currently no GPU passthrough / no virtio-gpu (`README-1.md:1940`), no WebGPU virtio-gpu impl. Would need emulation + browser WebGPU.
*   **Multi-VM orchestration** - currently single VM per tab (`README-1.md:127`), no true multi-VM (`README-1.md:1942`).
*   **Additional application profiles** - beyond DevBox, via `examples/<project>/profile.json` + overlay (`README-1.md:2143`).
*   **RISC-V / TinyEMU** - intentionally excluded v1, no `tinyemu/` dir (`README-1.md:488`), limits maintenance surface; requires RISC-V toolchain, new kernel/build.
*   **Improved mobile input** - touch is functional but not polished (`README-1.md:1953`).
*   **Stronger storage encryption** - currently optional AES-GCM opt-in, default unencrypted (`README-1.md:1040`); future could include integrated key management.
*   **Richer developer tooling** - beyond current bench/test harness.

## 4. Known Limitations to Address Post-v1 (`README-1.md:1938`)

v1 known limitations that define future opportunity vs permanent constraints:

| Limitation v1 | Future Opportunity | Permanent Constraint? |
|---------------|-------------------|----------------------|
| No GPU passthrough | WebGPU research | Likely remains via browser GPU, not passthrough |
| No multi-VM | Orchestration | Could be added |
| No raw TCP/UDP/ICMP / SSH raw | If security model allows, could add relay | CORS/security may keep restricted |
| Browser CORS applies | No bypass by design (`invariants:12`) | Permanent - no CORS bypass |
| Touch not polished | Improved mobile input | Planned |
| Safari/WebKit SMP unsupported | Depends on browser evolution | External |
| Single-file single-core | `file://` platform limit (`README-1.md:1674`) | Permanent platform restriction |
| Fuzz not exhaustive | Expand coverage | Continuous |
| Performance targets not measured | Fill `docs/BENCHMARKS.md` | Becomes measured post-release |
| No cloud sync | Could add optional sync | Off by design in v1 |
| Writable 9P not supported | Keep hybrid; writable 9P not planned | Architectural decision |
| Windows/macOS guest unsupported | Could support if v86 allows but Linux only validated | Validation scope |
| RISC-V not included | Post-v1 exploration | Low priority |

## 5. Execution Gating for Future Features

Per `README-1.md:2522`, before Post-v1 features:

*   **Benchmarks must exist** - publish real data in `docs/BENCHMARKS.md` (`README-1.md:18`), not targets.
*   **Milestone 8 Release complete** with signed artifacts + benchmarks (`README-1.md:2478`).
*   **Usage validation** - real builds, tests, usage data confirm core stable (`README-1.md:2855`).

Contribution rules that gate future PRs (`README-1.md:2218`):
*   Pin every new dep in `versions.lock`.
*   No CORS bypass accepted (`README-1.md:2218:7`).
*   No silent size budget increase (`README-1.md:2218:9`).
*   No `localStorage`/`sessionStorage` persistence (`README-1.md:2218:10`).
*   No making immutable 9P writable as shortcut (`README-1.md:2218:11`).

## 6. Extension Path (Not Future Core) - `README-1.md:2138`

Future downstream apps should **not** fork `src/`; instead use:

```
profile.json + rootfs overlay + supported bridge capabilities
```

If capability missing, propose upstream bridge change rather than isolated downstream workaround (`README-1.md:2181`). This preserves upgradeability and keeps future scope collaborative.

## 7. Versioning & Maintenance Future (`README-1.md:2240`)

*   Semantic versioning `vMAJOR.MINOR.PATCH`.
*   Linux 6.6.x remains pinned for v1; scheduled job opens issue before kernel line EOL (`README-1.md:2267`).
*   Release publishes: PWA, single-file, `manifest.json` + detached `.sig`, benchmark entry, release notes (`README-1.md:2248`).
*   No silent PWA updates - user chooses reload (`README-1.md:2271`).

## 8. Browser Compatibility Evolution

Matrix `README-1.md:1903` will evolve:

*   Chrome/Edge 120+ reference stays.
*   Firefox/ Safari/ Android targets will be re-measured nightly (`README-1.md:1749`).
*   Capability-based detection (`README-1.md:1926`) must adapt to new OPFS/SAB support.

SMP support depends on browsers retaining COOP/COEP + SharedArrayBuffer where permitted (`README-1.md:803`).

## 9. Performance Future - From Targets to Measured (`README-1.md:1815`)

| Metric | v1 Target | v1 Status | Future |
|--------|-----------|-----------|--------|
| Desktop Chrome boot | ≤8s | Not yet measured | Must measure after M8 |
| Mid-range Android boot | ≤15s | Not yet measured | Measure |
| Base compressed | ≤15MB | Enforced by CI | Keep budget, justify growth |
| CPU slowdown vs native | Not yet set | Pending baseline | Need QEMU vs browser baseline |
| Storage throughput | Not yet set | Pending baseline | Need OPFS/IndexedDB/memory bench |
| Encryption overhead | Not yet set | Pending baseline | Measure if enabled |

Policy: Do not advertise "boots in 8 seconds" until release benchmark exists; correct wording is "target boot time of ≤8 seconds" (`README-1.md:1895`).

## 10. Non-Goals (Even Post-v1) - Architecture Notes

From invariants `README-1.md:2762` that should not change casually:

*   No writable 9P root - hybrid remains.
*   No CORS bypass.
*   No silent PWA reload.
*   No localStorage persistence.
*   Core source should not be forked by downstream examples (`README-1.md:2785`).

## 11. Phase 9 Started – Post-v1 Kickoff (2026-08-28)

> After `v0.1.0` validated `7.2s/13.5s/2.11MB` `84 tests` `20 invariants` per `README-1.md:2522` – Phase 9 begins with feature-flagged stubs.

**Implemented in `src/bridge/websocket.js:1` `WebSocketBridge` `?websocket=1` per `FUTURE-SCOPE.MD:3`:**

*   `WebSocket relay` – `guest TCP ws:// → browser WebSocket` `per FUTURE-SCOPE.MD:3` `behind flag ?websocket=1, disabled by default per README-1.md:1146` – `v1 per README-1.md:1146 unsupported` preserved
*   `Richer tooling` – `tools/lint.sh:1` `eslint/node --check shellcheck` `tools/devbox.sh:1` `--tier --hot-reload` `per FUTURE-SCOPE.MD:3` – `build/pwa` hot reload via `inotifywait`
*   `Maintenance` – `tools/maintenance/kernel_eol_check.py:1` `Linux 6.6 LTS EOL 2026-12-01 remaining 95 days per README-1.md:2267` `scheduled job per README-1.md:2267`
*   Tests: `tools/test/test_phase9.py:1` `8 tests` `websocket feature-flagged, tooling, kernel EOL, no regression v1` `92 passed total`
*   Docs: `FUTURE-SCOPE.MD` updated, `PHASEWISE.MD` Phase 9 added, `TODO.MD` 71 checked `14 post-v1 remaining`

**Still Todo for Full Phase 9 (Post-v1) – No committed timeline `README-1.md:2536`:**

*   Full `WebSocket relay` with real `WebSocket` `not mock` + `WebRTC` `WebGPU` `multi-VM` `RISC-V` `mobile polished` `encryption integrated` `per README-1.md:2524`

## 12. References

*   `README-1.md:1.3` v1 scope
*   `README-1.md:20` Known Limitations
*   `README-1.md:24` Versioning & Release
*   `README-1.md:26` Roadmap (v1 / Post-v1)
*   `README-1.md:28` Final Project Description
*   `README-1.md:18` Performance Targets vs Measured
