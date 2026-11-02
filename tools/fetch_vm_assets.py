#!/usr/bin/env python3
"""Fetch the pinned, upstream demo VM artifacts; reject unexpected bytes."""
import hashlib
import io
import pathlib
import tarfile
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'build/vm-assets'
DOWNLOADS = {
    'v86-0.5.473.tgz': ('https://registry.npmjs.org/v86/-/v86-0.5.473.tgz', '364ab67a68c1d83646e2ddf7caf73c24574694a132b2b43689ad0f72e7242636'),
    'buildroot-bzimage68.bin': ('https://i.copy.sh/buildroot-bzimage68.bin', '507a759c70ab7a490a233be454d0b5b88bc667956a410b531cb4edc091e2eb1c'),
    'xterm-5.5.0.tgz': ('https://registry.npmjs.org/@xterm/xterm/-/xterm-5.5.0.tgz', 'bd954fa721872170188cc5d7e83e88db3c83c9a18a4e8d24c2783d26491f59d2'),
    'addon-fit-0.10.0.tgz': ('https://registry.npmjs.org/@xterm/addon-fit/-/addon-fit-0.10.0.tgz', '917ac44972453d5eed52edc1e50260c76398ce48cf2290c2e60671102bba0b33'),
}
BIOS = {
    'seabios.bin': '73e3f359102e3a9982c35fce98eb7cd08f18303ac7f1ba6ebfbe6cdc1c244d98',
    'vgabios.bin': 'a4bc0d80cc3ca028c73dafa8fee396b8d054ce87ebd8abfbd31b06b437607880',
}

def check(data, expected, name):
    if hashlib.sha256(data).hexdigest() != expected:
        raise ValueError(f'{name}: SHA-256 mismatch')
    return data

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    cache = ROOT / 'build/downloads'
    cache.mkdir(parents=True, exist_ok=True)
    for name, (url, digest) in DOWNLOADS.items():
        path = cache / name
        if not path.exists():
            print('Downloading', url, flush=True)
            with urllib.request.urlopen(url, timeout=120) as response:
                data = response.read()
            check(data, digest, name)
            path.write_bytes(data)
        check(path.read_bytes(), digest, name)
    with tarfile.open(cache / 'v86-0.5.473.tgz', 'r:gz') as archive:
        for name in ('libv86.js', 'v86.wasm', 'v86-fallback.wasm'):
            (OUT / name).write_bytes(archive.extractfile('package/build/' + name).read())
        (OUT / 'V86-LICENSE').write_bytes(archive.extractfile('package/LICENSE').read())
    (OUT / 'buildroot-bzimage68.bin').write_bytes((cache / 'buildroot-bzimage68.bin').read_bytes())
    with tarfile.open(cache / 'xterm-5.5.0.tgz', 'r:gz') as archive:
        for source, dest in [('package/lib/xterm.js','xterm.js'), ('package/css/xterm.css','xterm.css'), ('package/LICENSE','XTERM-LICENSE')]:
            (OUT / dest).write_bytes(archive.extractfile(source).read())
    with tarfile.open(cache / 'addon-fit-0.10.0.tgz', 'r:gz') as archive:
        for source, dest in [('package/lib/addon-fit.js','addon-fit.js'), ('package/LICENSE','XTERM-FIT-LICENSE')]:
            (OUT / dest).write_bytes(archive.extractfile(source).read())
    for name, digest in BIOS.items():
        path = ROOT / 'src/emulator/v86/bios' / name
        if not path.exists():
            raise FileNotFoundError('Run git submodule update --init --recursive')
        (OUT / name).write_bytes(check(path.read_bytes(), digest, name))
    print('Verified VM assets in', OUT)

if __name__ == '__main__':
    main()
