"""Regression checks for the generated preview's artifact manifest."""
import hashlib
import json
import pathlib
import subprocess
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]

class PreviewPackagingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        subprocess.run([sys.executable, 'tools/pack.py', '--tier', 'base', '--target', 'pwa'], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
        cls.pwa = ROOT / 'build/pwa'

    def test_manifest_hashes_match_packaged_bytes(self):
        manifest = json.loads((self.pwa / 'manifest-base.json').read_text())
        self.assertTrue(manifest['artifacts'])
        for info in manifest['artifacts'].values():
            data = (self.pwa / info['file']).read_bytes()
            self.assertEqual(hashlib.sha256(data).hexdigest(), info['sha256'])

    def test_workspace_module_is_packaged_and_cached(self):
        html = (self.pwa / 'app.js').read_text()
        self.assertIn('./workspace.js', html)
        self.assertTrue((self.pwa / 'workspace.js').is_file())
        self.assertIn('./workspace.js', (self.pwa / 'sw.js').read_text())

    def test_desktop_resources_are_packaged_and_cached(self):
        for filename in ('desktop.js', 'lessons.js', 'developer.js', 'backup.js', 'notes.js', 'calculator.js', 'projects.js', 'checkpoints.js', 'persistent-disk.js', 'alpine-bootstrap.js', 'wallpaper.jpg'):
            self.assertTrue((self.pwa / filename).is_file())
            self.assertIn('./' + filename, (self.pwa / 'sw.js').read_text())

    def test_terminal_guest_assets_are_packaged_and_cached(self):
        manifest = json.loads((self.pwa / 'manifest-base.json').read_text())
        sw = (self.pwa / 'sw.js').read_text()
        for name in ('buildroot-bzimage68.bin', 'xterm.js', 'xterm.css', 'addon-fit.js'):
            self.assertIn(name, manifest['artifacts'])
            self.assertIn('./assets/' + name, sw)
        for license_name in ('XTERM-LICENSE', 'XTERM-FIT-LICENSE'):
            self.assertTrue((self.pwa / 'assets' / license_name).is_file())

    def test_optional_alpine_package(self):
        image = ROOT / 'build/vm-assets/alpine-virt-3.24.3-x86.iso'
        if not image.is_file(): self.skipTest('Run tools/fetch_alpine.py to test the optional Alpine package')
        subprocess.run([sys.executable,'tools/pack.py','--tier','base','--target','pwa','--guest','alpine'],cwd=ROOT,check=True,stdout=subprocess.DEVNULL)
        output = ROOT / 'build/pwa-alpine'
        manifest = json.loads((output/'manifest-base.json').read_text())
        self.assertEqual(manifest['guest'],'alpine')
        info = manifest['artifacts']['alpine-virt-3.24.3-x86.iso']
        self.assertEqual(hashlib.sha256((output/info['file']).read_bytes()).hexdigest(),info['sha256'])
        self.assertIn('./assets/alpine-virt-3.24.3-x86.iso',(output/'sw.js').read_text())
        html=(output/'index.html').read_text()
        self.assertIn('Alpine Linux 3.24.3',html)
        self.assertIn('persistent overlay root',html)
        seed=manifest['artifacts']['alpine-data-ext2.img.gz']
        self.assertEqual(hashlib.sha256((output/seed['file']).read_bytes()).hexdigest(),seed['sha256'])
        self.assertIn('./assets/alpine-data-ext2.img.gz',(output/'sw.js').read_text())
        self.assertTrue((output/'persistent-disk.js').exists())
        self.assertNotIn('buildroot-bzimage68.bin',manifest['artifacts'])

    def test_real_vm_is_not_misrepresented(self):
        html = (self.pwa / 'index.html').read_text()
        self.assertIn('Buildroot 2024.05.2', html)
        self.assertNotIn('Booted (Phase 9', html)
        self.assertNotIn('7.2s boot', html)
        self.assertIn('Integrity check failed', (self.pwa / 'app.js').read_text())

if __name__ == '__main__':
    unittest.main()
