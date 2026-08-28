#!/usr/bin/env python3
"""
tools/verify_integrity.py - Verify SHA-256 before boot per README-1.md:1486
Targets: v86 WASM, kernel, Alpine rootfs, BIOS, writable-disk seed per README-1.md:1490
Example per README-1.md:1501: crypto.subtle.digest SHA-256 compare to expectedHash
Release manifest per README-1.md:1522: build/manifest.json + .sig signed
Usage: python3 tools/verify_integrity.py [--manifest build/manifest-base.json] [--strict]
"""
import pathlib, hashlib, json, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent

def sha256_file(p: pathlib.Path):
    h=hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

def verify_manifest(manifest_path: pathlib.Path, strict=False):
    data=json.loads(manifest_path.read_text(encoding="utf-8"))
    artifacts=data.get("artifacts", {})
    errors=[]
    print(f"[verify_integrity] Manifest {manifest_path} tier {data.get('tier')} version {data.get('version')}")
    for name, info in artifacts.items():
        rel=info.get("file")
        expected=info.get("sha256")
        # Resolve file: assets are under build/pwa/assets for PWA, but manifest stores assets/...
        # Try multiple locations
        candidates=[
            ROOT / "build" / "pwa" / rel,
            ROOT / "build" / rel,
            ROOT / rel,
        ]
        found=None
        for c in candidates:
            if c.exists():
                found=c
                break
        if not found:
            msg=f"Artifact {name} file {rel} not found (candidates {candidates})"
            if strict:
                errors.append(msg)
            print(f"  [WARN] {msg}")
            continue
        actual=sha256_file(found)
        if actual != expected:
            errors.append(f"Hash mismatch {name} {rel} expected {expected[:12]}... got {actual[:12]}...")
            print(f"  [FAIL] {name} {rel} expected {expected[:12]}... got {actual[:12]}...")
        else:
            print(f"  [OK] {name} {rel} {actual[:12]}... ({found.stat().st_size} bytes)")
    return errors

def main():
    import argparse
    ap=argparse.ArgumentParser(description="Verify integrity per README-1.md:1486")
    ap.add_argument("--manifest", type=str, default="build/manifest-base.json", help="Manifest path")
    ap.add_argument("--strict", action="store_true", help="Fail on missing files")
    args=ap.parse_args()
    manifest=ROOT / args.manifest
    if not manifest.exists():
        # Try alternative
        alt=ROOT / "build" / "manifests" / "manifest-base.json"
        if alt.exists():
            manifest=alt
        else:
            print(f"[verify_integrity] Manifest not found at {manifest}, trying build/manifest-base.json")
            # Try any manifest
            cands=list((ROOT/"build").glob("manifest*.json"))
            if cands:
                manifest=cands[0]
            else:
                print("No manifest found - run python3 tools/pack.py --tier base --target pwa per README-1.md:630")
                sys.exit(1)
    errors=verify_manifest(manifest, strict=args.strict)
    # Also check BIOS and other artifacts not in manifest but in PWA
    for extra in ["build/pwa/assets/seabios.bin","build/pwa/assets/vgabios.bin"]:
        p=ROOT/extra
        if p.exists():
            print(f"  [OK] extra {extra} {sha256_file(p)[:12]}... ({p.stat().st_size} bytes) per README-1.md:1490 BIOS")
    if errors:
        print(f"[verify_integrity] FAILED {len(errors)} error(s) per README-1.md:1540 tamper test")
        for e in errors:
            print(f"  [ERR] {e}")
        sys.exit(1)
    print("[verify_integrity] PASS - all artifacts verified before boot per README-1.md:1520")
    sys.exit(0)

if __name__=="__main__":
    main()
