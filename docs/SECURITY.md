# SECURITY.md - Threat Model & Boundaries

> Derived from `README-1.md:14` Security Model & Threat Boundaries.
> `README-1.md:2762` invariants 10-17, 13.

## Threat Model Table per README-1.md:1372

| Layer | Provides | Not Guaranteed |
|-------|----------|----------------|
| Browser/WASM sandbox | Defense-in-depth against host code execution | No independent pen-test v1 |
| Boot integrity | SHA-256 before boot (tools/verify_integrity.py) | Does not detect legitimately signed malicious artifact |
| Supply chain | Pinning + SBOM (versions.lock, build/manifests/sbom-*.spdx.json) | No audit of every upstream |
| Network | Off by default; HTTP/HTTPS only (src/bridge/network.js) | No raw egress (no relay) |
| Persistence | Dedicated Worker + atomic (src/bridge/worker/storage-worker.js) | Browser profile access can expose unencrypted data |
| Device emulation | Automated fuzzing of VirtIO block/VGA/UART (tools/fuzz/run_fuzz.py) | Coverage not exhaustive per README-1.md:1721 |

## Key Policies

*   Networking OFF by default per `README-1.md:1174`, no CORS bypass per `README-1.md:1159` (enforced in src/bridge/network.js, tested in test_network.py, CODEOWNERS second review).
*   Integrity gated: SHA-256 via Web Crypto before boot per `README-1.md:1501` (tools/verify_integrity.py, tools/verify_manifest.py, test_integrity.py tamper test per README-1.md:1540).
*   Every dep pinned in `versions.lock` per `README-1.md:1474`, verified via tools/verify_versions.py.
*   First-run disclosure non-bypassable per `README-1.md:745` (src/ui/firstrun/firstrun.js).
*   No escape-proof claims per `README-1.md:1378`.
*   Second-maintainer review per `README-1.md:1482` (CODEOWNERS).

## Integrity Verification per README-1.md:1486

*   Targets: v86 WASM, kernel, Alpine rootfs, BIOS per README-1.md:1490 via tools/verify_integrity.py.
*   Release manifest + signature per README-1.md:1522 via tools/sign_manifest.py and tools/verify_manifest.py.
*   Tamper test per README-1.md:1540 via tools/test/test_integrity.py.

## CI Security per README-1.md:1726

*   PR 12 steps Chromium + storage + network per .github/workflows/pr.yml
*   Nightly Firefox/WebKit + fuzz per .github/workflows/nightly.yml
*   Release all browsers + benchmarks + signed per .github/workflows/release.yml

## Known Limitations

*   No independent penetration test in v1 per README-1.md:1372.
*   Fuzzing not exhaustive per README-1.md:1721.

See `docs/BACKEND.MD:5` and `README-1.md:14`.
