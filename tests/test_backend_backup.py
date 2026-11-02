import os
import sqlite3
from contextlib import contextmanager, closing
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from server import create_server
from backup import online_backup, offline_restore

@contextmanager
def database(path):
    with closing(sqlite3.connect(path)) as conn:
        with conn: yield conn

class BackupTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.dir = Path(self.tmp.name)
        self.db = self.dir / 'workspace.sqlite3'; self.backup = self.dir / 'backup.sqlite3'
        self.server = create_server('127.0.0.1',0,str(self.db),'x'*32)
        with database(self.db) as c:
            c.execute('INSERT INTO projects VALUES (?,?)',('demo',1))
            c.execute('INSERT INTO files VALUES (?,?,?,?,?,?)',('demo','src/a','first',5,'a'*32,1))
            c.execute('INSERT INTO files VALUES (?,?,?,?,?,?)',('demo','pic.bin',b'\x00\xff',2,'b'*32,1))
    def tearDown(self):
        self.server.server_close(); self.tmp.cleanup()
    def test_online_backup_and_offline_restore(self):
        online_backup(self.db,self.backup)
        self.assertEqual(os.stat(self.backup).st_mode & 0o777,0o600)
        with self.assertRaises(FileExistsError): online_backup(self.db,self.backup)
        with database(self.db) as c: c.execute("UPDATE files SET content=?,size=? WHERE path='src/a'",('second',6))
        with self.assertRaises(BlockingIOError): offline_restore(self.db,self.backup)
        self.server.server_close()
        offline_restore(self.db,self.backup)
        with database(self.db) as c:
            row = c.execute("SELECT content,revision FROM files WHERE path='src/a'").fetchone()
            self.assertEqual(row[0],'first'); self.assertNotEqual(row[1],'a'*32)
        self.server = create_server('127.0.0.1',0,str(self.db),'x'*32)
    def test_bad_backup_does_not_replace_database(self):
        invalid = self.dir/'broken'; invalid.write_bytes(b'not sqlite')
        self.server.server_close()
        with self.assertRaises(sqlite3.DatabaseError): offline_restore(self.db,invalid)
        with database(self.db) as c: self.assertEqual(c.execute("SELECT content FROM files WHERE path='src/a'").fetchone()[0],'first')
        self.server = create_server('127.0.0.1',0,str(self.db),'x'*32)
    def test_reject_extra_objects_and_sidecars(self):
        online_backup(self.db,self.backup)
        with database(self.backup) as c: c.execute('CREATE TABLE injected (x TEXT)')
        self.server.server_close()
        with self.assertRaises(ValueError): offline_restore(self.db,self.backup)
        Path(str(self.db)+'-wal').touch()
        with self.assertRaises(ValueError): offline_restore(self.db,self.backup)
        Path(str(self.db)+'-wal').unlink()
        self.server = create_server('127.0.0.1',0,str(self.db),'x'*32)

if __name__=='__main__': unittest.main()
