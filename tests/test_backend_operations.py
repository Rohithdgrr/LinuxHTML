import json
import os
import sqlite3
from contextlib import contextmanager, closing
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT / 'backend'))
from operations import candidates, inspect_health, rotate_backup, notify_webhook
from unittest.mock import patch, MagicMock
from server import initialize

@contextmanager
def database(path):
    with closing(sqlite3.connect(path)) as conn:
        with conn: yield conn

class OperationsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.dir = Path(self.tmp.name)
        self.db = self.dir / 'db.sqlite3'; self.bak = self.dir / 'backups'; self.bak.mkdir(mode=0o700)
        initialize(self.db)
        with database(self.db) as c:
            c.execute('INSERT INTO projects VALUES (?,?)',('demo',1))
            c.execute('INSERT INTO files VALUES (?,?,?,?,?,?)',('demo','src/a','value',5,'a'*32,1))
    def tearDown(self): self.tmp.cleanup()
    def test_rotation_preserves_unrelated_files_and_symlinks(self):
        unrelated = self.bak/'important.txt'; unrelated.write_text('keep')
        link = self.bak/'linuxhtml-20250101T000000000000Z-abcdefabcdef.sqlite3'; link.symlink_to(unrelated)
        for _ in range(5): rotate_backup(self.db,self.bak,keep=3)
        self.assertEqual(len(candidates(self.bak)),3); self.assertTrue(link.is_symlink()); self.assertEqual(unrelated.read_text(),'keep')
        for p in candidates(self.bak):
            self.assertEqual(p.stat().st_mode & 0o777,0o600)
            with database(p) as c: self.assertEqual(c.execute('SELECT content FROM files').fetchone()[0],'value')
    def test_active_db_name_and_future_backup_are_safe(self):
        rotate_backup(self.db,self.bak,keep=1)
        future = self.bak/'linuxhtml-29990101T000000000000Z-abcdefabcdef.sqlite3'
        candidates(self.bak)[0].rename(future)
        new = Path(rotate_backup(self.db,self.bak,keep=1)['created'])
        self.assertTrue(new.exists()); self.assertFalse(future.exists())
        # A database named like a managed backup must never be pruned.
        with self.assertRaises(ValueError): rotate_backup(new,self.bak,keep=1)
        self.assertTrue(new.exists())

    def test_failed_backup_never_prunes_previous(self):
        rotate_backup(self.db,self.bak,keep=2); before = candidates(self.bak)
        self.db.write_bytes(b'broken database')
        with self.assertRaises(sqlite3.DatabaseError): rotate_backup(self.db,self.bak,keep=1)
        self.assertEqual(candidates(self.bak),before)
        self.assertFalse(list(self.bak.glob('.linuxhtml-pending-*')))
    def test_monitor_missing_stale_and_corrupt(self):
        self.assertFalse(inspect_health(self.db,self.bak,min_free_mib=0)['ok'])
        rotate_backup(self.db,self.bak)
        good=inspect_health(self.db,self.bak,min_free_mib=0)
        self.assertTrue(good['ok']); self.assertEqual(good['checks']['database']['files'],1)
        stale=inspect_health(self.db,self.bak,max_age_hours=1,min_free_mib=0,now=9999999999)
        self.assertIn('Latest backup is too old',stale['alerts'])
        candidates(self.bak)[0].write_bytes(b'bad backup')
        self.assertFalse(inspect_health(self.db,self.bak,min_free_mib=0)['checks']['backup']['ok'])
    def test_webhook_policy_and_delivery(self):
        for url in ('http://example.org/alert','https://user:pass@example.org/x','https://example.org/x#fragment'):
            with self.assertRaises(ValueError): notify_webhook(url, {'ok':False,'alerts':['low disk']})
        response = MagicMock(); response.status=204
        response.__enter__.return_value=response
        opener=MagicMock(); opener.open.return_value=response
        with patch('operations.build_opener',return_value=opener): notify_webhook('https://example.org/alert',{'ok':False,'alerts':['low disk']})
        request=opener.open.call_args.args[0]
        self.assertEqual(request.method,'POST');self.assertIn(b'low disk',request.data)
        self.assertNotIn(b'value',request.data)

    def test_cli_status_codes(self):
        script=ROOT/'backend/operations.py'; cmd=[sys.executable,str(script),'monitor','--database',str(self.db),'--backup-dir',str(self.bak),'--min-free-mib','0']
        failed=subprocess.run(cmd,capture_output=True,text=True);self.assertEqual(failed.returncode,1); self.assertFalse(json.loads(failed.stdout)['ok'])
        subprocess.run([sys.executable,str(script),'backup','--database',str(self.db),'--backup-dir',str(self.bak),'--keep','2'],check=True,capture_output=True,text=True)
        ok=subprocess.run(cmd,capture_output=True,text=True);self.assertEqual(ok.returncode,0);self.assertTrue(json.loads(ok.stdout)['ok'])

if __name__=='__main__': unittest.main()
