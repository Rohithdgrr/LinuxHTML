#!/usr/bin/env python3
"""
tools/serve.py - Development server for LinuxHTML
Must be used for PWA (not python -m http.server) per README-1.md:195, README-1.md:728
Provides required headers:
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
Required for cross-origin-isolated environment for SharedArrayBuffer/SMP per README-1.md:198, README-1.md:204
Serves build/pwa/ (or build/ for single-file overview) with correct MIME and headers.
"""
import argparse
import http.server
import socketserver
import pathlib
import sys
import os
import mimetypes

ROOT = pathlib.Path(__file__).resolve().parent.parent
DEFAULT_DIR = ROOT / "build" / "pwa"
FALLBACK_DIR = ROOT / "build"
DEFAULT_PORT = 8080

# Ensure wasm correct MIME
mimetypes.add_type("application/wasm", ".wasm")
mimetypes.add_type("application/manifest+json", ".webmanifest")

class CoepHandler(http.server.SimpleHTTPRequestHandler):
    """Handler that adds COOP/COEP headers to every response."""
    def __init__(self, *args, directory=None, **kwargs):
        super().__init__(*args, directory=str(directory), **kwargs)

    def end_headers(self):
        # Required for SharedArrayBuffer / SMP per README-1.md:198
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        # Additional security/hint headers
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, format, *args):
        sys.stdout.write("[serve.py] %s - - [%s] %s\n" % (self.client_address[0], self.log_date_time_string(), format%args))

def find_serve_dir(args_dir):
    if args_dir:
        p = pathlib.Path(args_dir)
        if not p.is_absolute():
            p = ROOT / p
        if not p.exists():
            print(f"[serve.py] ERROR: directory {p} does not exist", file=sys.stderr)
            print(f"  Hint: Run ./build.sh --tier base --target pwa first (README-1.md:184)", file=sys.stderr)
            sys.exit(1)
        return p.resolve()
    # Auto-detect: prefer build/pwa, fallback to build, else root
    if DEFAULT_DIR.exists():
        return DEFAULT_DIR.resolve()
    if FALLBACK_DIR.exists() and any(FALLBACK_DIR.iterdir()):
        return FALLBACK_DIR.resolve()
    # If no build artifacts, serve docs / root with warning
    print(f"[serve.py] WARN: {DEFAULT_DIR} not found. Serving {ROOT} (build artifacts missing).", file=sys.stderr)
    print(f"  Run: ./build.sh --tier base --target pwa --verify (README-1.md:652)", file=sys.stderr)
    return ROOT.resolve()

def main():
    parser = argparse.ArgumentParser(description="LinuxHTML dev server with COOP/COEP (README-1.md:195)")
    parser.add_argument("--port", "-p", type=int, default=DEFAULT_PORT, help=f"Port (default {DEFAULT_PORT})")
    parser.add_argument("--dir", "-d", type=str, default=None, help="Directory to serve (default: build/pwa or build)")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host (default 127.0.0.1)")
    parser.add_argument("--open", action="store_true", help="Print URL and try to open browser")
    args = parser.parse_args()

    serve_dir = find_serve_dir(args.dir)
    port = args.port
    host = args.host

    # Reuse address to avoid TIME_WAIT issues
    socketserver.TCPServer.allow_reuse_address = True

    handler_factory = lambda *a, **kw: CoepHandler(*a, directory=serve_dir, **kw)

    with socketserver.TCPServer((host, port), handler_factory) as httpd:
        url = f"http://{host}:{port}"
        print("="*64)
        print(f" LinuxHTML dev server")
        print(f" Serving: {serve_dir}")
        print(f" URL: {url}")
        print(f" Headers: COOP=same-origin, COEP=require-corp (README-1.md:198)")
        print(f" SMP: {'Yes (PWA+COOP/COEP) per README-1.md:805' if 'pwa' in str(serve_dir) else 'No - use PWA build for SMP'}")
        print(f" Do NOT use `python -m http.server` for PWA (README-1.md:728)")
        print(f" Expected: capability probe -> verify -> disclosure -> v86 -> Linux boot -> login (root, no password)")
        print(f" Press Ctrl+C to stop")
        print("="*64)
        if args.open:
            import webbrowser
            webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[serve.py] Shutting down...")
            httpd.shutdown()

if __name__ == "__main__":
    main()
