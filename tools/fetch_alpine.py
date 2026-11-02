#!/usr/bin/env python3
"""Fetch the pinned official Alpine virtual ISO for the optional PWA image."""
import hashlib
from pathlib import Path
from urllib.request import urlopen

URL = 'https://dl-cdn.alpinelinux.org/alpine/v3.24/releases/x86/alpine-virt-3.24.3-x86.iso'
SHA256 = '07e06ac189483fdfc3b83029a32d896a3a08df3bc18943ef4cc552c9a86787fd'
ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'build/vm-assets/alpine-virt-3.24.3-x86.iso'

def main():
    DEST.parent.mkdir(parents=True, exist_ok=True)
    if DEST.exists():
        if hashlib.sha256(DEST.read_bytes()).hexdigest() == SHA256:
            print('Verified existing Alpine ISO:',DEST); return
        raise SystemExit('Existing Alpine ISO hash mismatch; remove it before re-downloading')
    with urlopen(URL,timeout=120) as response: data = response.read()
    if hashlib.sha256(data).hexdigest() != SHA256: raise SystemExit('Alpine ISO SHA-256 mismatch')
    DEST.write_bytes(data)
    print('Downloaded and verified Alpine ISO:',DEST)

if __name__ == '__main__': main()
