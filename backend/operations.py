"""Self-hosted server backup rotation and local health checks (Linux/Unix)."""
import argparse
from contextlib import closing
from datetime import datetime, timezone
import fcntl
import json
import os
from pathlib import Path
import re
import secrets
import sqlite3
import stat
import sys
import time
from urllib.parse import urlsplit
from urllib.request import Request, HTTPRedirectHandler, build_opener
from backup import online_backup, ro, validate

PATTERN = re.compile(r'^linuxhtml-(\d{8}T\d{12}Z)-([0-9a-f]{12})\.sqlite3$')


def fsync_dir(path):
    fd = os.open(path, os.O_RDONLY | getattr(os, 'O_DIRECTORY', 0))
    try: os.fsync(fd)
    finally: os.close(fd)


def candidates(directory):
    """Only regular files with our exact naming convention are managed."""
    results = []
    for file in Path(directory).iterdir():
        if PATTERN.fullmatch(file.name) and stat.S_ISREG(file.lstat().st_mode):
            results.append(file)
    return sorted(results, key=lambda p: p.name, reverse=True)


def rotate_backup(database, directory, keep=7):
    if not 1 <= keep <= 365: raise ValueError('Retention must be between 1 and 365')
    db = Path(database).resolve()
    directory = Path(directory).resolve()
    if not directory.is_dir(): raise ValueError('Backup directory must already exist')
    if not db.is_file(): raise ValueError('Database does not exist')
    if db.parent == directory and PATTERN.fullmatch(db.name): raise ValueError('Database name conflicts with managed backup pattern')
    fd = os.open(directory / '.linuxhtml-rotation.lock', os.O_RDWR | os.O_CREAT, 0o600)
    temporary = None
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        nonce = secrets.token_hex(6)
        final = directory / f'linuxhtml-{stamp}-{nonce}.sqlite3'
        temporary = directory / f'.linuxhtml-pending-{nonce}'
        online_backup(db, temporary)
        # Linking commits atomically without overwriting a pre-existing name.
        os.link(temporary, final)
        temporary.unlink(); temporary = None
        fsync_dir(directory)
        removed = 0
        # Always retain the newly created backup, even if older filenames are dated in the future.
        previous = [file for file in candidates(directory) if file != final]
        for file in previous[max(0,keep-1):]:
            file.unlink(); removed += 1
        fsync_dir(directory)
        return {'created':str(final),'removed':removed,'kept':len(candidates(directory))}
    finally:
        if temporary is not None: temporary.unlink(missing_ok=True)
        os.close(fd)


def inspect_health(database, directory, max_age_hours=48, min_free_mib=256, now=None):
    if max_age_hours <= 0 or min_free_mib < 0: raise ValueError('Invalid monitoring thresholds')
    db, directory = Path(database).resolve(), Path(directory).resolve()
    report = {'ok':True, 'checks':{}, 'alerts':[]}
    def alert(message): report['ok'] = False; report['alerts'].append(message)
    try:
        if not db.is_file(): raise ValueError('missing')
        with closing(ro(db)) as c:
            c.execute('PRAGMA trusted_schema=OFF')
            if c.execute('PRAGMA quick_check').fetchall() != [('ok',)]: raise ValueError('integrity')
            projects = c.execute('SELECT COUNT(*) FROM projects').fetchone()[0]
            files, total = c.execute('SELECT COUNT(*),COALESCE(SUM(size),0) FROM files').fetchone()
        report['checks']['database'] = {'ok':True, 'projects':projects, 'files':files, 'content_bytes':total}
    except (OSError, sqlite3.Error, ValueError):
        report['checks']['database'] = {'ok':False}; alert('Database unavailable or failed integrity check')
    for label, path in [('database_disk',db.parent),('backup_disk',directory)]:
        try:
            st = os.statvfs(path); available = st.f_bavail * st.f_frsize
            good = available >= min_free_mib * 1024 * 1024
            report['checks'][label] = {'ok':good, 'available_bytes':available}
            if not good: alert(label + ' has low free space')
        except OSError:
            report['checks'][label] = {'ok':False}; alert(label + ' unavailable')
    try:
        files = candidates(directory)
        if not files: raise ValueError('No backups')
        latest = files[0]
        timestamp = datetime.strptime(PATTERN.fullmatch(latest.name).group(1),'%Y%m%dT%H%M%S%fZ').replace(tzinfo=timezone.utc).timestamp()
        age = (time.time() if now is None else now) - timestamp
        if age < -300: raise ValueError('Backup timestamp in future')
        validate(latest)
        good = age <= max_age_hours * 3600
        report['checks']['backup'] = {'ok':good, 'age_seconds':max(0,round(age)), 'count':len(files)}
        if not good: alert('Latest backup is too old')
    except (OSError, sqlite3.Error, ValueError):
        report['checks']['backup'] = {'ok':False}; alert('No usable recent backup')
    return report


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def notify_webhook(url, report):
    """Send only aggregate health results; URL comes from trusted administrator config."""
    parts = urlsplit(url)
    if parts.scheme != 'https' or not parts.hostname or parts.username or parts.password or parts.fragment:
        raise ValueError('Alert webhook must be an HTTPS URL without userinfo or fragment')
    body = json.dumps({'event':'linuxhtml.health.failed','report':report},sort_keys=True).encode('utf-8')
    req = Request(url,data=body,headers={'Content-Type':'application/json','User-Agent':'LinuxHTML-Monitor/1'},method='POST')
    with build_opener(NoRedirect()).open(req,timeout=10) as response:
        if not 200 <= response.status < 300: raise OSError('Alert endpoint rejected notification')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='action',required=True)
    backup = sub.add_parser('backup',help='Create, verify and rotate backups')
    monitor = sub.add_parser('monitor',help='Check database, free space and latest backup')
    for cmd in (backup,monitor):
        cmd.add_argument('--database',required=True); cmd.add_argument('--backup-dir',required=True)
    backup.add_argument('--keep',type=int,default=7)
    monitor.add_argument('--max-age-hours',type=float,default=48); monitor.add_argument('--min-free-mib',type=int,default=256)
    monitor.add_argument('--alert-url-env',help='Environment variable containing an HTTPS webhook URL; sends alerts on failure')
    args = parser.parse_args()
    try:
        if args.action == 'backup': result = rotate_backup(args.database,args.backup_dir,args.keep)
        else: result = inspect_health(args.database,args.backup_dir,args.max_age_hours,args.min_free_mib)
        if args.action == 'monitor' and not result['ok'] and args.alert_url_env:
            url = os.environ.get(args.alert_url_env)
            if url:
                try: notify_webhook(url,result); result['alert_delivery'] = 'sent'
                except Exception: result['alert_delivery'] = 'failed'  # never print the URL or request error
            else: result['alert_delivery'] = 'not_configured'
        print(json.dumps(result,sort_keys=True)); return 0 if args.action == 'backup' or result['ok'] else 1
    except (OSError, sqlite3.Error, ValueError) as e:
        print(json.dumps({'ok':False,'error':str(e)}),file=sys.stderr); return 1

if __name__ == '__main__': sys.exit(main())
