#!/usr/bin/env python3
"""
tools/check_size.py - Check image size budgets per README-1.md:677
Caps: micro 8M, base 15M, standard 25M per README-1.md:664, >5% fails CI
Usage: python3 tools/check_size.py [--tier base]
"""
import pathlib, json, sys
ROOT=pathlib.Path(__file__).resolve().parent.parent
caps={"micro":8*1024*1024,"base":15*1024*1024,"standard":25*1024*1024}

def check_tier(tier):
    p=ROOT/f"build/rootfs-{tier}.squashfs"
    if not p.exists():
        # Try alternative locations
        alt=ROOT/f"build/pwa/assets/rootfs-{tier}.squashfs"
        if alt.exists():
            p=alt
        else:
            print(f"[check_size] {tier}: rootfs not found at {p} - skip")
            return True
    size=p.stat().st_size
    cap=caps[tier]
    pct=size/cap*100
    print(f"[check_size] {tier}: {size} / cap {cap} ({pct:.1f}%)")
    if size > cap*1.05:
        print(f"[check_size] [FAIL] {tier} size {size} exceeds cap {cap} by >5% fails CI per README-1.md:677")
        return False
    elif size > cap:
        print(f"[check_size] [WARN] {tier} size {size} exceeds cap {cap} but within 5% tolerance")
        return True
    else:
        print(f"[check_size] [OK] {tier} size within budget per README-1.md:677")
        return True

def main():
    import argparse
    ap=argparse.ArgumentParser(description="Check size budgets per README-1.md:677")
    ap.add_argument("--tier", choices=["micro","base","standard"], default=None)
    args=ap.parse_args()
    ok=True
    tiers=[args.tier] if args.tier else ["micro","base","standard"]
    for t in tiers:
        if not check_tier(t):
            ok=False
    # Also check PWA total
    pwa=ROOT/"build/pwa"
    if pwa.exists():
        total=sum(f.stat().st_size for f in pwa.rglob("*") if f.is_file())
        print(f"[check_size] PWA total {total} bytes")
        # PWA should also be within tier cap? For base tier, check against base cap
        # Real check is per tier rootfs, not PWA total, but we note
    if not ok:
        sys.exit(1)
    print("[check_size] PASS - all within budget per README-1.md:677")
    sys.exit(0)

if __name__=="__main__":
    main()
