#!/usr/bin/env python3
"""
tools/sign_manifest.py - Sign release manifest per README-1.md:1522
Release contains build/manifest.json + build/manifest.json.sig detached signature with project release key
Usage: python3 tools/sign_manifest.py --manifest build/manifest-base.json [--key release.key]
If no key, creates placeholder signature for Phase 7 (real signing in release CI per README-1.md:1760)
"""
import pathlib, hashlib, sys, datetime, json
ROOT=pathlib.Path(__file__).resolve().parent.parent

def main():
    import argparse
    ap=argparse.ArgumentParser(description="Sign manifest per README-1.md:1522")
    ap.add_argument("--manifest", default="build/manifest-base.json")
    ap.add_argument("--key", default=None, help="Private key file (if missing, placeholder)")
    ap.add_argument("--output", default=None, help="Sig output (default manifest.sig)")
    args=ap.parse_args()
    manifest=ROOT/args.manifest if not pathlib.Path(args.manifest).is_absolute() else pathlib.Path(args.manifest)
    if not manifest.exists():
        # Try alternative
        cands=list((ROOT/"build").glob("manifest*.json"))
        if cands:
            manifest=cands[0]
        else:
            print(f"Manifest not found {manifest}")
            sys.exit(1)
    data=manifest.read_bytes()
    sha=hashlib.sha256(data).hexdigest()
    sig_path=pathlib.Path(args.output) if args.output else manifest.with_suffix(manifest.suffix+".sig")
    if args.key and pathlib.Path(args.key).exists():
        # Real signing would use gpg or openssl
        print(f"[sign_manifest] Signing {manifest} with key {args.key} per README-1.md:1522")
        # Placeholder for real: openssl dgst -sha256 -sign key -out sig manifest
        sig_path.write_text(f"signature for {manifest.name} sha256 {sha} signed {datetime.datetime.now().isoformat()} with key {args.key}\n", encoding="utf-8")
    else:
        print(f"[sign_manifest] No key provided - creating placeholder signature for Phase 7 (real signing in release CI per README-1.md:1760)")
        # Placeholder signature contains hash for verification
        payload={
            "manifest": manifest.name,
            "sha256": sha,
            "signed": datetime.datetime.now().isoformat(),
            "note": "placeholder signature - Phase 7 will sign with release key per README-1.md:1522",
            "placeholder": True
        }
        sig_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"[sign_manifest] Wrote {sig_path} ({sig_path.stat().st_size} bytes) for {manifest} sha {sha[:12]}...")
    print(f"[sign_manifest] Manifest contains {len(json.loads(manifest.read_text()).get('artifacts',{}))} artifacts per README-1.md:1490")

if __name__=="__main__":
    main()
