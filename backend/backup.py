"""Online SQLite backup and offline restore for the experimental workspace API."""
import argparse
from contextlib import closing
import os
from pathlib import Path
import re
import sqlite3
import tempfile
from urllib.parse import quote
from server import MAX_FILE, MAX_FILES, MAX_TOTAL, PROJECT, lock_db, valid_path


def ro(path):
    return sqlite3.connect('file:' + quote(str(Path(path).resolve()), safe='/') + '?mode=ro', uri=True)


def validate(path):
    """Reject invalid or foreign schema and data; backups still must come from a trusted source."""
    with closing(ro(path)) as c:
        c.execute('PRAGMA trusted_schema=OFF')
        if c.execute('PRAGMA quick_check').fetchall() != [('ok',)]: raise ValueError('Database integrity check failed')
        schema = c.execute("SELECT type,name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").fetchall()
        if schema != [('table', 'files'), ('table', 'projects')]: raise ValueError('Unexpected database schema')
        def columns(table): return [(x[1],x[2],x[3],x[5]) for x in c.execute('PRAGMA table_info(' + table + ')')]
        if columns('projects') != [('name','TEXT',0,1),('created','INTEGER',1,0)] or columns('files') != [('project','TEXT',1,1),('path','TEXT',1,2),('content','TEXT',1,0),('size','INTEGER',1,0),('revision','TEXT',1,0),('updated','INTEGER',1,0)]: raise ValueError('Unexpected database columns')
        if c.execute('PRAGMA foreign_key_check').fetchone(): raise ValueError('Invalid project references')
        projects = set()
        for name, created in c.execute('SELECT name,created FROM projects'):
            if not isinstance(name,str) or not PROJECT.fullmatch(name) or type(created) is not int: raise ValueError('Invalid project data')
            projects.add(name)
        usage = {}
        for project,path,content,size,revision,updated in c.execute('SELECT project,path,content,size,revision,updated FROM files'):
            if (project not in projects or not isinstance(path,str) or not valid_path(path) or not isinstance(content,(str,bytes)) or type(size) is not int or size != len(content.encode('utf-8') if isinstance(content,str) else content) or size > MAX_FILE or not isinstance(revision,str) or not re.fullmatch(r'[0-9a-f]{32}',revision) or type(updated) is not int): raise ValueError('Invalid file data')
            count,total = usage.get(project,(0,0)); usage[project] = count+1,total+size
            if count+1 > MAX_FILES or total+size > MAX_TOTAL: raise ValueError('Project exceeds limits')


def online_backup(db, destination):
    db, destination = Path(db).resolve(), Path(destination).absolute()
    if not db.is_file(): raise ValueError('Source database does not exist')
    if destination.resolve() == db: raise ValueError('Backup cannot replace the live database')
    fd = os.open(destination, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    os.close(fd)
    try:
        source, target = ro(db), sqlite3.connect(destination)
        try: source.backup(target)
        finally: source.close(); target.close()
        validate(destination)
        with open(destination,'rb') as out: os.fsync(out.fileno())
    except BaseException:
        destination.unlink(missing_ok=True)
        raise


def offline_restore(db, source):
    db, source = Path(db).resolve(), Path(source).resolve()
    if db == source: raise ValueError('Restore source and database must differ')
    if not db.parent.is_dir() or not source.is_file(): raise ValueError('Database directory or backup missing')
    lock = lock_db(str(db), exclusive=True)
    temp = None
    try:
        for suffix in ('-wal','-shm','-journal'):
            if Path(str(db)+suffix).exists(): raise ValueError('Database sidecar exists; resolve it before restoring')
        validate(source)
        fd, tempname = tempfile.mkstemp(prefix='.linuxhtml-restore-',dir=db.parent); temp = Path(tempname); os.close(fd)
        src, dest = ro(source), sqlite3.connect(temp)
        try: src.backup(dest)
        finally: src.close(); dest.close()
        validate(temp)
        # Invalidate revisions held by clients from before the restore (ABA avoidance).
        with closing(sqlite3.connect(temp)) as c:
            with c: c.execute('UPDATE files SET revision=lower(hex(randomblob(16)))')
        with open(temp,'rb') as f: os.fsync(f.fileno())
        os.replace(temp,db); temp = None
        directory = os.open(db.parent,os.O_RDONLY)
        try: os.fsync(directory)
        finally: os.close(directory)
    finally:
        if temp: temp.unlink(missing_ok=True)
        os.close(lock)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['backup','restore'])
    parser.add_argument('--database',required=True,help='workspace.sqlite3 path')
    parser.add_argument('--file',required=True,help='backup file path')
    parser.add_argument('--confirm-replace',action='store_true',help='required for restore')
    args = parser.parse_args()
    try:
        if args.action == 'backup': online_backup(args.database,args.file)
        else:
            if not args.confirm_replace: parser.error('restore replaces the database; pass --confirm-replace after stopping the server')
            offline_restore(args.database,args.file)
    except (OSError, sqlite3.Error, ValueError) as e: parser.exit(1, f'{args.action} failed: {e}\n')
    print(f'{args.action} completed. Files are unencrypted; protect backups.')

if __name__ == '__main__': main()
