"""Loopback-only development host for PWA + API. Not a production reverse proxy."""
import http.client
import os
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from server import MAX_BODY, MAX_ARCHIVE, create_server

root = Path(__file__).resolve().parents[1]
data_dir = os.environ.get('LINUXHTML_DATA_DIR', str(root / 'build' / 'dev-backend'))
os.makedirs(data_dir, mode=0o700, exist_ok=True)
api = create_server('127.0.0.1', 0, os.path.join(data_dir, 'workspace.sqlite3'), os.environ.get('LINUXHTML_API_TOKEN',''))
Thread(target=api.serve_forever, daemon=True).start()

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
    def proxy(self):
        if not self.path.startswith('/api/'):
            self.send_error(404); return
        try: size = int(self.headers.get('Content-Length', '0'))
        except ValueError: self.send_error(400); return
        if size < 0 or size > (MAX_ARCHIVE if self.path.split('?')[0].endswith('/archive') else MAX_BODY) or self.headers.get('Transfer-Encoding'): self.send_error(413); return
        headers = {k: self.headers[k] for k in ('Authorization','Content-Type') if self.headers.get(k)}
        body = self.rfile.read(size) if size else None
        c = http.client.HTTPConnection('127.0.0.1', api.server_port, timeout=20)
        try:
            c.request(self.command, self.path[4:], body=body, headers=headers)
            result = c.getresponse(); raw = result.read(); self.send_response(result.status)
            for name in ('Content-Type','Content-Disposition','Cache-Control','X-Content-Type-Options'):
                if result.getheader(name): self.send_header(name,result.getheader(name))
            self.send_header('Content-Length', str(len(raw))); self.end_headers(); self.wfile.write(raw)
        finally: c.close()
    def do_GET(self):
        if self.path.startswith('/api/'): return self.proxy()
        return super().do_GET()
    do_POST = do_PUT = do_DELETE = proxy

if __name__ == '__main__':
    port = int(os.environ.get('LINUXHTML_DEV_PORT','8766'))
    static = root / 'build' / 'pwa'
    if not (static / 'index.html').exists(): raise SystemExit('Build the PWA first: python3 tools/pack.py --tier base --target pwa')
    server = ThreadingHTTPServer(('127.0.0.1',port),partial(Handler,directory=str(static)))
    print(f'Development only: http://127.0.0.1:{port}/ (loopback only)',flush=True)
    try: server.serve_forever()
    finally: server.server_close(); api.shutdown(); api.server_close()
