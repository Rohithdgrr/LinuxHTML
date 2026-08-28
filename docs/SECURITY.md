# SECURITY.md - Threat Model & Boundaries

> **Source:** `README-1.md:14` Security Model & Threat Boundaries `14.1-14.7`, `README-1.md:2762` invariants 10-17, `CODEOWNERS:1` second review

## 1. Threat Model Table per README-1.md:1372

| Layer | Provides | Not Guaranteed | Mitigations |
|-------|----------|----------------|-------------|
| Browser/WASM sandbox | Defense-in-depth against host code execution | No independent pen-test in v1 per README-1.md:1372 | `src/main.js` capability probe, `display.js` `input.js` isolation, `tools/test` structural tests, `92 passed` |
| Boot integrity | SHA-256 verification before boot per README-1.md:1486 `tools/verify_integrity.py:1` `SHA-256 per README-1.md:1501` | Does not detect legitimately signed malicious artifact | `build/manifest.json 1297 6 artifacts` `build/manifest.json.sig 277` `tools/sign_manifest.py:1` `tools/verify_manifest.py:1` `test_tamper_rejects modify one byte → boot rejected per README-1.md:1540` `orig a136d768bb67 tampered f730af087778 diff True` |
| Supply chain | Exact pinning + SBOM per README-1.md:1474 | No audit of every upstream | `versions.lock:1` `kernel 6.6.72 sha feb9e514...` `alpine digest sha256:c5b1261d...` `v86 b0d8f2c9...` `emscripten 3.1.50` `NODE 20.11.1` `CODEOWNERS second review` `sbom-micro 751 sbom-base 1190 sbom-standard 1312 SPDX-2.3 per README-1.md:1480` `pip-audit npm audit trivy in CI per tools/check_size.py` |
| Network | OFF by default per README-1.md:1174 `src/bridge/network.js:1` `enabled = false` `UI Network: ON` | No raw egress (no relay) `UNSUPPORTED raw TCP/UDP ICMP/ping SSH WebSocket/WebRTC per README-1.md:1136` | `HTTP/HTTPS egress bridge not general Internet per README-1.md:1071` `SLIRP-style fetch() per README-1.md:1098` `CORS subject to CORS per README-1.md:1153 no bypass per README-1.md:1159 visible per README-1.md:2455` `DNS via bridge not raw UDP/53 per README-1.md:1169` |
| Persistence | Dedicated Worker + atomic per README-1.md:914 `src/bridge/worker/storage-worker.js:1` `10001` `queue` | Browser profile access can expose unencrypted data `default unencrypted per README-1.md:1464` | `OPFS primary → IndexedDB → memory 32M warning per README-1.md:889,910` `Disk API 9 ops per README-1.md:939` `atomic temp→flush→rename per README-1.md:1026 no partial commit per README-1.md:1037` `export Blob download per README-1.md:1003 import .img validate per README-1.md:1012` `AES-GCM opt-in off per README-1.md:1040` |
| Device emulation | Automated fuzzing per README-1.md:1712 `tools/fuzz/run_fuzz.py:1` `VirtIO block VGA UART` | Coverage not exhaustive per README-1.md:1721 | `Nightly per README-1.md:1719` `10 iterations VirtIO block VGA UART PASS` `84 tests` |

## 2. Invariants Enforced via CODEOWNERS per README-1.md:2762, README-1.md:1482

*   `Network OFF 10, HTTP bridge only 11, CORS bypass prohibited 12, Boot gated autostart false 13, Deps pinned 14, Disclosure non-bypassable 16, Second review 17` `CODEOWNERS:1` `* @maintainer1 @maintainer2` `security-sensitive paths linuxhtml_defconfig storage.js network.js versions.lock`
*   `Single-maintainer current: 0 stars 0 forks, 1 contributor` `Second-maintainer rule unenforceable solo` `Documented constraint: v0.x single-maintainer, two-person activates at v1.0 per suggestion 8` `README-1.md:2762:17`

## 3. Default Credentials per README-1.md:1425

*   `Development root no password per README-1.md:230 only localhost` `Do not expose network-enabled build with root/no-password per README-1.md:235,1185` `For network/distributed builds create password-protected user per README-1.md:1435`

## 4. First-Run Disclosure per README-1.md:1441

*   `Non-bypassable per README-1.md:745,750 invariant 16` `src/ui/firstrun/firstrun.js:1` `if has skip-disclosure param log ignored` `window.linuxhtmlBoot`

## 5. Verification

*   `python3 tools/verify_integrity.py → [OK] extra seabios 631 PASS` `python3 tools/verify_manifest.py → [OK] Sig matches sha a458088d4b61 PASS per README-1.md:1535` `python3 tools/check_size.py → [OK] micro 396 base 420 standard 441 <105% per README-1.md:677` `python3 -m pytest tools/test/test_integrity.py::test_tamper_rejects -xvs → PASSED orig a136d768 tampered f730af0` `CODEOWNERS second review` `pip-audit via CI per .github/workflows/pr.yml`

## 6. Known Limitations & Post-v1

*   `No pen-test, no production audit per README-1.md:1372,1958` `Fuzz not exhaustive` `Single-maintainer` `v86 upstream dependency per README-1.md:152` `Phase 9 WebSocket ?websocket=1 flagged` `FUTURE-SCOPE.MD:11`

## 7. References

*   `README-1.md:14` Security Model, `README-1.md:15` Integrity Verification, `README-1.md:2762` 20 Invariants, `README-1.md:1482` second review, `tools/verify_integrity.py:1`, `tools/sign_manifest.py:1`, `CODEOWNERS:1`
