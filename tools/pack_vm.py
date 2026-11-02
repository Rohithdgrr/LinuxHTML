"""Package the experimental real v86/Linux demo. No placeholders are accepted."""
import hashlib
import json
import pathlib
import shutil

ROOT = pathlib.Path(__file__).resolve().parents[1]

def build_pwa(tier, guest="buildroot"):
    if tier != 'base':
        raise ValueError('The real VM currently supports only the base tier')
    source = ROOT / 'build/vm-assets'
    expected = {
        'libv86.js': 'e257912c4a1129e36a86c1e2df69904ab969d87bffd24aa6676e84d6ddffc1c6',
        'v86.wasm': '2f0c4150f266415b754a84a32e6f8e4c975a1d3abb94c78b047fa30027db1ef1',
        'v86-fallback.wasm': '4eb64c9b7908d5931c1868eea4824b3a0a628eb86e6eac09d133776b50922d81',
        'seabios.bin': '73e3f359102e3a9982c35fce98eb7cd08f18303ac7f1ba6ebfbe6cdc1c244d98',
        'vgabios.bin': 'a4bc0d80cc3ca028c73dafa8fee396b8d054ce87ebd8abfbd31b06b437607880',
        'buildroot-bzimage68.bin': '507a759c70ab7a490a233be454d0b5b88bc667956a410b531cb4edc091e2eb1c',
        'xterm.js': '1f991ac3b4b283ebf96e60ae23a00a52765dd3a2e46fa6fdda9f1aab032f7495',
        'xterm.css': 'ba8e6985669488981ccf40c0cefe3aba80722cb6c92de7ad628b0bd717faf2b6',
        'addon-fit.js': 'bdaefa370b1bfc42ee88d46fe6072400902a4d4b2d45cd93438dda9b23c97089',
    }
    if guest == 'alpine':
        expected.pop('buildroot-bzimage68.bin')
        expected['alpine-virt-3.24.3-x86.iso'] = '07e06ac189483fdfc3b83029a32d896a3a08df3bc18943ef4cc552c9a86787fd'
    elif guest != 'buildroot':
        raise ValueError('Unknown guest')
    names = list(expected)
    if any(not (source / n).is_file() for n in names):
        raise FileNotFoundError('VM assets missing; run python3 tools/fetch_vm_assets.py and, for Alpine, python3 tools/fetch_alpine.py')
    output = ROOT / ('build/pwa-alpine' if guest == 'alpine' else 'build/pwa')
    shutil.rmtree(output, ignore_errors=True)
    (output / 'assets').mkdir(parents=True)
    artifacts = {}
    for name in names:
        data = (source / name).read_bytes()
        if hashlib.sha256(data).hexdigest() != expected[name]:
            raise ValueError(f'{name}: pinned SHA-256 mismatch; re-fetch VM assets')
        (output / 'assets' / name).write_bytes(data)
        artifacts[name] = {'file': 'assets/' + name, 'sha256': hashlib.sha256(data).hexdigest()}
    if guest == 'alpine':
        seed_name = 'alpine-data-ext2.img.gz'
        data = (ROOT / 'src/ui/vm' / seed_name).read_bytes()
        if hashlib.sha256(data).hexdigest() != '6f6b5d5faa1202bcdf851888ab9658e953a6f3a9f349559bfc0a9f28956bbb70':
            raise ValueError('Persistent disk seed SHA-256 mismatch')
        (output / 'assets' / seed_name).write_bytes(data)
        artifacts[seed_name] = {'file':'assets/' + seed_name, 'sha256':hashlib.sha256(data).hexdigest()}
    for license_name in ['V86-LICENSE', 'XTERM-LICENSE', 'XTERM-FIT-LICENSE']:
        shutil.copy2(source / license_name, output / 'assets' / license_name)
    for name in ['index.html', 'app.js', 'app.css', 'workspace.js', 'desktop.js', 'lessons.js', 'developer.js', 'backup.js', 'notes.js', 'calculator.js', 'projects.js', 'checkpoints.js', 'persistent-disk.js', 'alpine-bootstrap.js', 'wallpaper.jpg']:
        shutil.copy2(ROOT / 'src/ui/vm' / name, output / name)
    if guest == 'alpine':
        index = output / 'index.html'
        html = index.read_text()
        html = html.replace('This experimental VM uses an upstream Buildroot 2024.05.2 image with Linux 6.8.12, not the planned Alpine Linux. This image is not maintained by LinuxHTML and should not be used for sensitive workloads.', 'This experimental VM boots the official Alpine Linux 3.24.3 virtual installer ISO in memory. The system boots from a live image and enters an experimental browser-backed overlay root after login. Changes to most root files persist; /run, /proc, /sys, /dev and the shared /mnt remain temporary. This is not a fully installed system or a production guest. Do not use it for sensitive workloads.')
        html = html.replace('Click the screen and type. No network relay is configured; guest files are temporary.', 'At the login prompt type root and press Enter. The browser-backed root and shared /mnt are mounted automatically. Run sync before restarting. No network relay is configured.')
        html = html.replace('Guest changes are lost on reload unless you explicitly save and restore an experimental VM checkpoint. Checkpoints are unencrypted and can be evicted; they are not a backup.', 'The Alpine shell uses an experimental persistent overlay root. Browser storage can be evicted or cleared, and runtime mounts and files in /mnt are temporary. Disk backups are unencrypted; export important data and run sync before closing.')
        html = html.replace('serial console</strong><span> · Linux / Buildroot', 'serial console</strong><span> · Linux / Alpine')
        html = html.replace('Shell scripts run with the guest’s <code>sh</code>. Lua is available; Python, Node and Git are not included in this experimental image.', 'Shell scripts run with the guest’s <code>sh</code>. Additional toolchains are not included and package downloads require a network relay, which is not configured.')
        html = html.replace('The Linux guest is outdated and not intended for sensitive workloads.', 'The Linux guest is experimental, is not automatically updated, and is not intended for sensitive workloads.')
        html = html.replace('<input id="restore-checkpoint" type="checkbox"> Restore this guest’s saved checkpoint instead of starting fresh', '<input id="restore-checkpoint" type="checkbox" disabled> Checkpoints are not available for the Alpine preview')
        html = html.replace('<button id="save-checkpoint" type="button">', '<button id="save-checkpoint" type="button" disabled title="Not available for Alpine">')
        html = html.replace('<button id="delete-checkpoint" type="button">', '<button id="delete-checkpoint" type="button" disabled title="Not available for Alpine">')
        index.write_text(html)
    manifest = {'version': 'experimental-vm-1', 'tier': tier, 'guest': guest, 'artifacts': artifacts,
                'note': 'Unsigned manifest; hashes protect against corruption, not a malicious publisher.'}
    manifest_bytes = json.dumps(manifest, indent=2).encode()
    (output / 'manifest-base.json').write_bytes(manifest_bytes)
    if guest == 'buildroot': (ROOT / 'build/manifest-base.json').write_bytes(manifest_bytes)
    webmanifest = {'name': 'LinuxHTML experimental VM', 'short_name': 'LinuxHTML', 'start_url': './',
                   'display': 'standalone', 'background_color': '#f3f5f8', 'theme_color': '#086bbd'}
    (output / 'manifest.webmanifest').write_text(json.dumps(webmanifest, indent=2))
    files = ['index.html', 'app.js', 'app.css', 'workspace.js', 'desktop.js', 'lessons.js', 'developer.js', 'backup.js', 'notes.js', 'calculator.js', 'projects.js', 'checkpoints.js', 'persistent-disk.js', 'alpine-bootstrap.js', 'wallpaper.jpg', 'manifest-base.json', 'manifest.webmanifest'] + [v['file'] for v in artifacts.values()]
    digest = hashlib.sha256(b''.join((output / f).read_bytes() for f in files)).hexdigest()[:16]
    sw = '''const CACHE = %s;
const FILES = %s;
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('linuxhtml-') && k !== CACHE).map(k => caches.delete(k))))));
self.addEventListener('fetch', e => { if(e.request.method === 'GET' && new URL(e.request.url).origin === self.location.origin) e.respondWith(caches.open(CACHE).then(c => c.match(e.request)).then(r => r || fetch(e.request))); });
''' % (json.dumps('linuxhtml-vm-' + digest), json.dumps(['./'] + ['./' + f for f in files]))
    (output / 'sw.js').write_text(sw)
    print(f'Packaged experimental Linux VM at {output}; manifest is unsigned')
    return output
