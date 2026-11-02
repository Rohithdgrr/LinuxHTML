"""Experimental single-owner workspace API. Run behind an authenticated TLS proxy.

No shell execution, accounts, sync client, guest persistence, or package management.
"""
import fcntl
import base64
import binascii
import io
import stat
import zipfile
import zlib
from contextlib import contextmanager
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

MAX_BODY = 1024 * 1024
MAX_ARCHIVE = 60 * 1024 * 1024
MAX_FILE = 700 * 1024
MAX_FILES = 1000
MAX_TOTAL = 50 * 1024 * 1024
PROJECT = re.compile(r'[A-Za-z0-9][A-Za-z0-9_-]{0,63}\Z')


def valid_path(path):
    return (0 < len(path) <= 512 and not path.startswith('/') and '\\' not in path
            and all(part not in ('', '.', '..') and len(part) <= 128 and all(ord(c) >= 32 and ord(c) != 127 for c in part)
                    for part in path.split('/')))


@contextmanager
def connect(db):
    c = sqlite3.connect(db, timeout=10)
    try:
        c.execute('PRAGMA foreign_keys = ON')
        with c:
            yield c
    finally:
        c.close()


def lock_db(db, exclusive=False):
    """Cooperative lock for servers and offline restore (Linux/Unix only)."""
    lock_path = os.path.realpath(db) + '.lock'
    fd = os.open(lock_path, os.O_CREAT | os.O_RDWR, 0o600)
    try:
        fcntl.flock(fd, (fcntl.LOCK_EX if exclusive else fcntl.LOCK_SH) | fcntl.LOCK_NB)
    except BaseException:
        os.close(fd)
        raise
    return fd


def initialize(db):
    with connect(db) as c:
        c.executescript('''CREATE TABLE IF NOT EXISTS projects (name TEXT PRIMARY KEY, created INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS files (project TEXT NOT NULL REFERENCES projects(name) ON DELETE CASCADE,
        path TEXT NOT NULL, content TEXT NOT NULL, size INTEGER NOT NULL, revision TEXT NOT NULL,
        updated INTEGER NOT NULL, PRIMARY KEY(project,path));''')


def create_server(host, port, db, token):
    if not token or len(token) < 32:
        raise ValueError('LINUXHTML_API_TOKEN must be at least 32 characters')
    db = os.path.realpath(db)
    lock_fd = lock_db(db)
    try:
        fd = os.open(db, os.O_CREAT | os.O_RDWR, 0o600)
        os.close(fd)
        initialize(db)
    except BaseException:
        os.close(lock_fd)
        raise

    class Handler(BaseHTTPRequestHandler):
        server_version = 'LinuxHTML-Experimental'
        sys_version = ''
        def log_message(self, fmt, *args):
            # Avoid logging paths, tokens, or file contents.
            pass
        def reply(self, code, data):
            raw = json.dumps(data, ensure_ascii=False).encode('utf-8')
            self.send_response(code); self.send_header('Content-Type','application/json; charset=utf-8')
            self.send_header('Content-Length',str(len(raw))); self.send_header('Cache-Control','no-store')
            self.send_header('X-Content-Type-Options','nosniff'); self.end_headers(); self.wfile.write(raw)
        def binary_reply(self, data, filename):
            self.send_response(200); self.send_header('Content-Type','application/zip')
            self.send_header('Content-Disposition',f'attachment; filename="{filename}.zip"')
            self.send_header('Content-Length',str(len(data))); self.send_header('Cache-Control','no-store')
            self.send_header('X-Content-Type-Options','nosniff'); self.end_headers(); self.wfile.write(data)
        def raw_body(self, limit):
            if self.headers.get('Transfer-Encoding'): raise ValueError('Transfer-Encoding is unsupported')
            try: size = int(self.headers.get('Content-Length','-1'))
            except ValueError: raise ValueError('Invalid Content-Length')
            if size < 0 or size > limit: raise ValueError('Body too large or missing length')
            data = self.rfile.read(size)
            if len(data) != size: raise ValueError('Incomplete request body')
            return data
        def body(self):
            try: return json.loads(self.raw_body(MAX_BODY).decode('utf-8'))
            except (ValueError, UnicodeDecodeError): raise ValueError('Invalid or oversized JSON')
        def route(self):
            url = urlsplit(self.path)
            if url.query or url.fragment: return None
            parts = url.path.split('/')
            try: parts = [unquote(p, errors='strict') for p in parts]
            except UnicodeDecodeError: return None
            if parts == ['', 'health']: return ('health',)
            if parts == ['', 'v1', 'projects']: return ('projects',)
            if parts == ['', 'v1', 'status']: return ('status',)
            if len(parts) == 4 and parts[:3] == ['', 'v1', 'projects'] and PROJECT.fullmatch(parts[3]): return ('project',parts[3])
            if len(parts) == 5 and parts[:3] == ['', 'v1', 'projects'] and PROJECT.fullmatch(parts[3]) and parts[4] in ('archive','move'): return (parts[4],parts[3])
            if len(parts) >= 6 and parts[:3] == ['', 'v1', 'projects'] and PROJECT.fullmatch(parts[3]) and parts[4] == 'files':
                path = '/'.join(parts[5:])
                if valid_path(path): return ('file', parts[3], path)
            if len(parts) == 5 and parts[:3] == ['', 'v1', 'projects'] and PROJECT.fullmatch(parts[3]) and parts[4] == 'files': return ('files',parts[3])
            return None
        def handle_request(self):
            route = self.route()
            if route == ('health',) and self.command == 'GET': return self.reply(200, {'status':'ok'})
            authorization = self.headers.get('Authorization','')
            if not hmac.compare_digest(authorization.encode(), ('Bearer '+token).encode()):
                return self.reply(401, {'error':'Unauthorized'})
            if not route: return self.reply(404, {'error':'Not found'})
            try:
                with connect(db) as c:
                    kind = route[0]
                    if kind == 'status' and self.command == 'GET':
                        projects = c.execute('SELECT COUNT(*) FROM projects').fetchone()[0]
                        files, content_bytes = c.execute('SELECT COUNT(*), COALESCE(SUM(size),0) FROM files').fetchone()
                        return self.reply(200, {'status':'ok','projects':projects,'files':files,'content_bytes':content_bytes,'database_bytes':os.path.getsize(db)})
                    if kind == 'projects' and self.command == 'GET':
                        return self.reply(200, {'projects':[{'name':r[0],'created':r[1]} for r in c.execute('SELECT name,created FROM projects ORDER BY name')]})
                    if kind == 'projects' and self.command == 'POST':
                        body = self.body()
                        if not isinstance(body,dict) or set(body) != {'name'} or not isinstance(body['name'],str) or not PROJECT.fullmatch(body['name']): raise ValueError('Invalid project name')
                        try: c.execute('INSERT INTO projects VALUES (?,?)',(body['name'],int(time.time()))); c.commit()
                        except sqlite3.IntegrityError: return self.reply(409, {'error':'Project already exists'})
                        return self.reply(201, {'name':body['name']})
                    if kind in ('project','files','file','archive','move') and not c.execute('SELECT 1 FROM projects WHERE name=?',(route[1],)).fetchone(): return self.reply(404, {'error':'Project not found'})
                    if kind == 'project' and self.command == 'DELETE':
                        body = self.body()
                        if body != {'confirm': route[1]}: raise ValueError('Project confirmation does not match')
                        c.execute('BEGIN IMMEDIATE')
                        if c.execute('SELECT 1 FROM files WHERE project=? LIMIT 1',(route[1],)).fetchone():
                            c.rollback(); return self.reply(409, {'error':'Project is not empty'})
                        c.execute('DELETE FROM projects WHERE name=?',(route[1],)); c.commit()
                        return self.reply(200, {'deleted':True})
                    if kind == 'move' and self.command == 'POST':
                        body = self.body()
                        if not isinstance(body,dict) or set(body) != {'source','destination','revision'} or not all(isinstance(body[k],str) for k in body) or not valid_path(body['source']) or not valid_path(body['destination']) or body['source'] == body['destination']:
                            raise ValueError('Invalid source, destination, or revision')
                        c.execute('BEGIN IMMEDIATE')
                        current = c.execute('SELECT revision FROM files WHERE project=? AND path=?',(route[1],body['source'])).fetchone()
                        target = c.execute('SELECT 1 FROM files WHERE project=? AND path=?',(route[1],body['destination'])).fetchone()
                        if not current or current[0] != body['revision'] or target:
                            c.rollback(); return self.reply(409, {'error':'Source changed or destination exists'})
                        revision = secrets.token_hex(16); updated = int(time.time())
                        c.execute('UPDATE files SET path=?,revision=?,updated=? WHERE project=? AND path=?',(body['destination'],revision,updated,route[1],body['source']))
                        c.commit(); return self.reply(200, {'revision':revision,'updated':updated})
                    if kind == 'archive' and self.command == 'GET':
                        out = io.BytesIO()
                        with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED) as archive:
                            for path,content in c.execute('SELECT path,content FROM files WHERE project=? ORDER BY path',(route[1],)):
                                archive.writestr(path,content.encode('utf-8') if isinstance(content,str) else content)
                        return self.binary_reply(out.getvalue(),route[1])
                    if kind == 'archive' and self.command == 'POST':
                        data = self.raw_body(MAX_ARCHIVE); entries = []; names = set(); total = 0
                        try:
                            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                                if len(archive.infolist()) > MAX_FILES * 2: raise ValueError('Archive has too many entries')
                                for item in archive.infolist():
                                    path = item.filename
                                    if item.flag_bits & 1 or stat.S_ISLNK(item.external_attr >> 16): raise ValueError('Encrypted entries and symlinks are not allowed')
                                    if item.is_dir():
                                        if not valid_path(path[:-1]): raise ValueError('Invalid archive path')
                                        continue
                                    if not valid_path(path) or path in names: raise ValueError('Invalid or duplicate archive path')
                                    names.add(path)
                                    if len(names) > MAX_FILES or item.file_size > MAX_FILE: raise ValueError('Archive exceeds file limits')
                                    total += item.file_size
                                    if total > MAX_TOTAL: raise ValueError('Archive exceeds project size limit')
                                    contents = archive.read(item)
                                    if len(contents) != item.file_size: raise ValueError('Invalid archive entry length')
                                    try:
                                        content = contents.decode('utf-8')
                                        if '\x00' in content: content = contents
                                    except UnicodeDecodeError: content = contents
                                    entries.append((path, content, len(contents)))
                        except (zipfile.BadZipFile, zipfile.LargeZipFile, NotImplementedError, RuntimeError, OSError, zlib.error) as e: raise ValueError('Invalid or unsupported ZIP archive') from e
                        c.execute('BEGIN IMMEDIATE')
                        count, used = c.execute('SELECT COUNT(*),COALESCE(SUM(size),0) FROM files WHERE project=?',(route[1],)).fetchone()
                        if count + len(entries) > MAX_FILES or used + total > MAX_TOTAL:
                            c.rollback(); return self.reply(413, {'error':'Project quota exceeded; nothing imported'})
                        try:
                            for path,content,size in entries:
                                c.execute('INSERT INTO files VALUES (?,?,?,?,?,?)',(route[1],path,content,size,secrets.token_hex(16),int(time.time())))
                            c.commit()
                        except sqlite3.IntegrityError:
                            c.rollback(); return self.reply(409, {'error':'A file already exists; nothing imported'})
                        return self.reply(201, {'imported':len(entries),'bytes':total})
                    if kind == 'files' and self.command == 'GET':
                        rows = c.execute('SELECT path,revision,size,updated FROM files WHERE project=? ORDER BY path',(route[1],))
                        return self.reply(200, {'files':[dict(zip(('path','revision','size','updated'),r)) for r in rows]})
                    if kind == 'file' and self.command == 'GET':
                        row = c.execute('SELECT content,revision,updated FROM files WHERE project=? AND path=?',route[1:]).fetchone()
                        if not row: return self.reply(404, {'error':'File not found'})
                        content, revision, updated = row
                        if isinstance(content, bytes):
                            return self.reply(200, {'content_base64':base64.b64encode(content).decode('ascii'),'revision':revision,'updated':updated})
                        return self.reply(200, {'content':content,'revision':revision,'updated':updated})
                    if kind == 'file' and self.command in ('PUT','DELETE'):
                        body = self.body()
                        if not isinstance(body,dict) or not (body.get('revision') is None or isinstance(body.get('revision'),str)): raise ValueError('Expected revision and content')
                        if self.command == 'DELETE':
                            if set(body) != {'revision'}: raise ValueError('Expected revision')
                        else:
                            if set(body) == {'revision','content'} and isinstance(body['content'],str):
                                content = body['content']; size = len(content.encode('utf-8'))
                            elif set(body) == {'revision','content_base64'} and isinstance(body['content_base64'],str):
                                try: content = base64.b64decode(body['content_base64'], validate=True)
                                except (ValueError, binascii.Error): raise ValueError('Invalid base64 content')
                                size = len(content)
                            else: raise ValueError('Provide revision and text content or content_base64')
                            if size > MAX_FILE: raise ValueError('Content exceeds file size limit')
                        c.execute('BEGIN IMMEDIATE')
                        old = c.execute('SELECT revision,size FROM files WHERE project=? AND path=?',route[1:]).fetchone()
                        if (old[0] if old else None) != body['revision'] or (self.command == 'DELETE' and not old):
                            c.rollback(); return self.reply(409, {'error':'Revision conflict'})
                        if self.command == 'DELETE':
                            c.execute('DELETE FROM files WHERE project=? AND path=?',route[1:]);c.commit();return self.reply(200, {'deleted':True})
                        count,total = c.execute('SELECT COUNT(*),COALESCE(SUM(size),0) FROM files WHERE project=?',(route[1],)).fetchone()
                        if count + (not old) > MAX_FILES or total - (old[1] if old else 0) + size > MAX_TOTAL: c.rollback(); return self.reply(413, {'error':'Project quota exceeded'})
                        rev = secrets.token_hex(16); updated = int(time.time())
                        c.execute('INSERT INTO files VALUES (?,?,?,?,?,?) ON CONFLICT(project,path) DO UPDATE SET content=excluded.content,size=excluded.size,revision=excluded.revision,updated=excluded.updated', (*route[1:], content, size, rev, updated));c.commit()
                        return self.reply(200 if old else 201, {'revision':rev,'updated':updated})
                    return self.reply(405, {'error':'Method not allowed'})
            except ValueError as e: return self.reply(400, {'error':str(e)})
            except (sqlite3.Error, OSError): return self.reply(503, {'error':'Storage unavailable'})
        do_GET = do_POST = do_PUT = do_DELETE = handle_request
    class WorkspaceServer(ThreadingHTTPServer):
        daemon_threads = False  # server_close waits for in-flight requests before releasing lock
        def server_close(self):
            try: super().server_close()
            finally:
                if self.lock_fd is not None:
                    os.close(self.lock_fd)
                    self.lock_fd = None
    try:
        server = WorkspaceServer((host, port), Handler)
        server.lock_fd = lock_fd
        return server
    except BaseException:
        os.close(lock_fd)
        raise

if __name__ == '__main__':
    data_dir = os.environ.get('LINUXHTML_DATA_DIR','./data')
    os.makedirs(data_dir,mode=0o700,exist_ok=True)
    server = create_server(os.environ.get('LINUXHTML_HOST','127.0.0.1'),int(os.environ.get('LINUXHTML_PORT','8080')),os.path.join(data_dir,'workspace.sqlite3'),os.environ.get('LINUXHTML_API_TOKEN',''))
    print('Experimental workspace API listening; use TLS proxy for nonlocal access.', flush=True)
    try: server.serve_forever()
    finally: server.server_close()
