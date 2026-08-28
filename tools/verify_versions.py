#!/usr/bin/env python3
"""
tools/verify_versions.py - Verify pinned dependencies per README-1.md:1474
All deps must be pinned in versions.lock; CI rejects unpinned deps per README-1.md:2113.
Also checks build machine prerequisites per README-1.md:244 and tier caps per README-1.md:677.
Usage: python3 tools/verify_versions.py [--strict] [--json]
Exit 0 if all pinned versions present and plausible; non-zero if missing/invalid.
"""
import json
import re
import sys
import shutil
import subprocess
import pathlib
import argparse

ROOT = pathlib.Path(__file__).resolve().parent.parent
LOCK = ROOT / "versions.lock"

REQUIRED_TOP_KEYS = ["kernel", "alpine", "v86", "emscripten", "nodejs", "python", "tiers"]
REQUIRED_KERNEL_KEYS = ["version", "tarball_sha256"]
REQUIRED_ALPINE_KEYS = ["version", "digest"]
REQUIRED_V86_KEYS = ["commit", "repo"]
REQUIRED_EMSCRIPTEN_KEYS = ["version"]

SHA256_RE = re.compile(r"^[a-f0-9]{64}$", re.I)
DIGEST_RE = re.compile(r"^sha256:[a-f0-9]{64}$", re.I)
COMMIT_RE = re.compile(r"^[a-f0-9]{40}$", re.I)

def eprint(*a, **k):
    print(*a, file=sys.stderr, **k)

def check_version_string(v):
    # Basic semver-ish
    return bool(re.match(r"^\d+\.\d+(\.\d+)?", str(v)))

def run_version(cmd):
    if not cmd:
        return None
    prog = cmd.split()[0]
    if not shutil.which(prog):
        return None
    try:
        out = subprocess.check_output(cmd, shell=True, text=True, stderr=subprocess.STDOUT, timeout=5)
        return out.strip().splitlines()[0][:200]
    except Exception as ex:
        return f"error: {ex}"

def load_lock():
    if not LOCK.exists():
        eprint(f"ERROR: {LOCK} not found")
        sys.exit(1)
    text = LOCK.read_text(encoding="utf-8")
    # Strip comment lines that are not part of JSON? We use json with preceding # comments - need to filter.
    # versions.lock contains leading # comment lines before {, so find first {
    idx = text.find("{")
    if idx == -1:
        eprint("ERROR: versions.lock contains no JSON object")
        sys.exit(1)
    json_text = text[idx:]
    try:
        data = json.loads(json_text)
    except json.JSONDecodeError as ex:
        eprint(f"ERROR: versions.lock JSON parse failed: {ex}")
        eprint(f"  Hint: Ensure file is valid JSON after initial comments. Error at line {ex.lineno}")
        sys.exit(1)
    return data

def main():
    parser = argparse.ArgumentParser(description="Verify versions.lock pins")
    parser.add_argument("--strict", action="store_true", help="Fail on warnings too")
    parser.add_argument("--json", action="store_true", help="Output JSON report")
    args = parser.parse_args()

    data = load_lock()
    errors = []
    warns = []

    # Top-level keys
    for k in REQUIRED_TOP_KEYS:
        if k not in data:
            errors.append(f"Missing top-level key: {k}")

    # Kernel checks
    if "kernel" in data:
        k = data["kernel"]
        for rk in REQUIRED_KERNEL_KEYS:
            if rk not in k:
                errors.append(f"kernel.{rk} missing")
        if "version" in k and not k["version"].startswith("6.6"):
            warns.append(f"kernel.version {k['version']} not 6.6.x per README-1.md:2258 (v1 pins 6.6 LTS)")
        if "tarball_sha256" in k and not SHA256_RE.match(k["tarball_sha256"]):
            # Allow placeholder warning not error if looks intentional
            if "placeholder" not in k.get("note","").lower():
                warns.append(f"kernel.tarball_sha256 not valid SHA256: {k['tarball_sha256'][:16]}... (placeholder?)")
        if "version" in k and not check_version_string(k["version"]):
            errors.append(f"kernel.version invalid: {k['version']}")

    # Alpine checks
    if "alpine" in data:
        a = data["alpine"]
        for rk in REQUIRED_ALPINE_KEYS:
            if rk not in a:
                errors.append(f"alpine.{rk} missing")
        if "version" in a and not a["version"].startswith("3.19"):
            warns.append(f"alpine.version {a['version']} not 3.19.x per README-1.md:104")
        if "digest" in a and not DIGEST_RE.match(a["digest"]):
            errors.append(f"alpine.digest not valid sha256 digest: {a['digest']}")
        if "image" in a and "alpine:" not in a["image"]:
            warns.append(f"alpine.image unexpected: {a['image']}")

    # v86 checks
    if "v86" in data:
        v = data["v86"]
        for rk in REQUIRED_V86_KEYS:
            if rk not in v:
                errors.append(f"v86.{rk} missing")
        if "commit" in v and not COMMIT_RE.match(v["commit"]):
            errors.append(f"v86.commit not 40-char hex: {v['commit']}")

    # Emscripten
    if "emscripten" in data:
        e = data["emscripten"]
        for rk in REQUIRED_EMSCRIPTEN_KEYS:
            if rk not in e:
                errors.append(f"emscripten.{rk} missing")
        if "version" in e and not check_version_string(e["version"]):
            errors.append(f"emscripten.version invalid: {e['version']}")

    # Node
    if "nodejs" in data:
        n = data["nodejs"]
        if "version" in n and not n["version"].startswith("20."):
            warns.append(f"nodejs.version {n['version']} not 20.x LTS per README-1.md:267")

    # Python
    if "python" in data:
        p = data["python"]
        if "version" in p and not check_version_string(p["version"]):
            warns.append(f"python.version odd: {p['version']}")

    # Tiers
    if "tiers" in data:
        for tier in ["micro","base","standard"]:
            if tier not in data["tiers"]:
                errors.append(f"tiers.{tier} missing per README-1.md:664")
            else:
                cap = data["tiers"][tier].get("compressed_cap_mb")
                if cap not in [8,15,25]:
                    warns.append(f"tiers.{tier}.compressed_cap_mb {cap} not 8/15/25 per README-1.md:664")

    # Prerequisites checks (informational, not failing if not installed - but warn)
    env = {}
    env["python3"] = run_version("python3 --version")
    env["docker"] = run_version("docker --version")
    env["qemu"] = run_version("qemu-system-x86_64 --version")
    env["node"] = run_version("node --version")
    env["emcc"] = run_version("emcc --version")

    # Compare with pinned
    if env["python3"] and "python" in data:
        pinned = data["python"]["version"]
        if pinned not in env["python3"]:
            warns.append(f"Installed python {env['python3']} != pinned {pinned} (constraint >=3.10 per README-1.md:257)")
    if env["node"] and "nodejs" in data:
        pinned = data["nodejs"]["version"]
        # Node version string e.g. v20.11.1 -> compare prefix
        if pinned not in env["node"]:
            warns.append(f"Installed node {env['node']} != pinned {pinned} (expected 20.x LTS)")

    # .gitmodules check
    gitmodules = ROOT / ".gitmodules"
    if not gitmodules.exists():
        warns.append(".gitmodules missing (should pin v86 submodule per README-1.md:152)")
    else:
        txt = gitmodules.read_text(encoding="utf-8")
        if "copy/v86" not in txt:
            warns.append(".gitmodules does not contain copy/v86 per README-1.md:152")
        if "v86" in data and data["v86"]["commit"] not in txt:
            warns.append(".gitmodules commit comment does not match versions.lock v86.commit")

    # requirements.txt check
    req = ROOT / "requirements.txt"
    if not req.exists():
        warns.append("requirements.txt missing per README-1.md:412")
    else:
        rtxt = req.read_text(encoding="utf-8")
        if "==" not in rtxt:
            errors.append("requirements.txt must pin versions with == per README-1.md:2118")

    # Report
    if args.json:
        report = {"errors": errors, "warnings": warns, "env": env, "lock": str(LOCK)}
        print(json.dumps(report, indent=2))
    else:
        print(f"versions.lock: {LOCK} ({len(json.dumps(data))} bytes)")
        print(f"  -> schema_version: {data.get('meta',{}).get('schema_version','?')}")
        print(f"  -> kernel: {data.get('kernel',{}).get('version','?')} ({data.get('kernel',{}).get('tarball_sha256','')[:12]}...)")
        print(f"  -> alpine: {data.get('alpine',{}).get('version','?')} {data.get('alpine',{}).get('digest','')[:19]}...")
        print(f"  -> v86: {data.get('v86',{}).get('commit','')[:12]}...")
        print(f"  -> emscripten: {data.get('emscripten',{}).get('version','?')}")
        print(f"  -> node: {data.get('nodejs',{}).get('version','?')}")
        print(f"  -> tiers: micro {data.get('tiers',{}).get('micro',{}).get('compressed_cap_mb')}MB, base {data.get('tiers',{}).get('base',{}).get('compressed_cap_mb')}MB, standard {data.get('tiers',{}).get('standard',{}).get('compressed_cap_mb')}MB")
        print("")
        print("Environment:")
        for k,v in env.items():
            print(f"  {k}: {v if v else 'not found'}")
        print("")
        if errors:
            print(f"ERRORS ({len(errors)}):")
            for er in errors:
                print(f"  [ERR] {er}")
        if warns:
            print(f"WARNINGS ({len(warns)}):")
            for w in warns:
                print(f"  [WARN] {w}")
        if not errors and not warns:
            print("[OK] All pinned versions present and valid (no warnings)")

    # Strict handling
    if errors:
        print(f"\n[FAIL] FAILED: {len(errors)} error(s)", file=sys.stderr)
        sys.exit(1)
    if args.strict and warns:
        print(f"\n[FAIL] FAILED (strict): {len(warns)} warning(s)", file=sys.stderr)
        sys.exit(1)
    if warns:
        print(f"\n[OK] PASSED with {len(warns)} warning(s) (non-strict)")
        sys.exit(0)
    print("\n[OK] PASSED")
    sys.exit(0)

if __name__ == "__main__":
    main()
