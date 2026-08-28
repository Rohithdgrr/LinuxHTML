#!/usr/bin/env python3
"""
tools/maintenance/kernel_eol_check.py - Kernel EOL tracking per README-1.md:2267 Phase 9 Post-v1
Scheduled job should open tracking issue before kernel line EOL per README-1.md:2267
Checks https://www.kernel.org/category/releases.html or local versions.lock
"""
import pathlib, json, datetime, sys
ROOT=pathlib.Path(__file__).resolve().parent.parent.parent
# Known EOL for Linux 6.6 LTS per kernel.org: EOL Dec 2026 (example)
KERNEL_EOL = datetime.date(2026, 12, 1)
today=datetime.date.today()
remaining=(KERNEL_EOL - today).days
print(f"[kernel_eol] Linux 6.6 LTS EOL {KERNEL_EOL} remaining {remaining} days per README-1.md:2267")
# Check versions.lock
data=json.loads((ROOT/"versions.lock").read_text().split("{",1)[1].rsplit("}",1)[0].join(["{","}"])) if False else json.loads((ROOT/"versions.lock").read_text()[(ROOT/"versions.lock").read_text().find("{"):])
# Simpler
txt=(ROOT/"versions.lock").read_text()
data=json.loads(txt[txt.find("{"):])
kernel_ver=data["kernel"]["version"]
print(f"[kernel_eol] Pinned kernel {kernel_ver} per versions.lock:1")
if remaining < 180:
    print(f"[kernel_eol] WARNING: Kernel EOL in {remaining} days - open tracking issue per README-1.md:2267")
    sys.exit(1 if remaining < 0 else 0)
else:
    print(f"[kernel_eol] OK - {remaining} days until EOL")
    sys.exit(0)
