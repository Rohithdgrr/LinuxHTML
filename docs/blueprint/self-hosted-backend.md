# Self-hosted backend: stages 1–3 (experimental)

Stages 1–3 add a single-owner project-file API in `backend/server.py` and an optional desktop Server projects app. The app supports nested server text/binary files, explicit editing and uploads/downloads, ZIP import/export, and manual local text-file copies. It is **not connected to the Linux guest**. It does not provide a durable installed guest root filesystem, working package downloads, networking, login/accounts, sync, remote execution, or a full monitoring system. An optional separately built Alpine live ISO can be booted; it is not an installed system. Stage 3 adds an authenticated aggregate storage status and a command-line online-backup/offline-restore tool. The existing Buildroot VM and flat local workspace are unchanged. This API is a foundation, not a production-ready service.

## Run locally

Requires Python 3.10+; standard library only. From the repository root:

```sh
export LINUXHTML_API_TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
export LINUXHTML_DATA_DIR="$HOME/linuxhtml-data"
python3 backend/server.py
```

The service listens on `127.0.0.1:8080` by default. `LINUXHTML_HOST` and `LINUXHTML_PORT` configure the listener. Store the token securely; do not commit it or embed it in browser code. The service has no TLS, request rate limiting, account isolation, authentication lifecycle, audit trail, or security review. **Do not expose it publicly as-is.** For self-hosting, use a properly configured TLS reverse proxy and host firewall, restrict access, keep the backend loopback-only, and provision/rotate secrets securely. A bearer token grants complete access to all projects. HTTP logs omit paths and credentials but infrastructure logs must also be configured safely. Host compromise can expose all files, and the SQLite database is unencrypted.

## API

`GET /health` is unauthenticated and only returns process availability, not a database health guarantee. All `/v1` requests require `Authorization: Bearer <token>`. Use JSON request bodies and `Content-Length` (chunked requests are unsupported). Errors return JSON and HTTP status codes.

- `GET /v1/status`: authenticated aggregate project/file counts, UTF-8 content bytes, and database file bytes; it queries the database but is not comprehensive monitoring.
- `GET /v1/projects`: list projects.
- `POST /v1/projects` with `{"name":"demo"}`: create a project. Names are 1–64 ASCII letters, digits, hyphens or underscores and start with a letter/digit.
- `DELETE /v1/projects/demo` with `{"confirm":"demo"}`: delete an empty project; non-empty projects are rejected.
- `GET /v1/projects/demo/files`: list file paths and revisions.
- `POST /v1/projects/demo/move` with `{"source":"a.txt","destination":"src/b.txt","revision":"<current revision>"}`: atomically move a saved file without overwriting; a stale revision or existing destination is rejected.
- `GET /v1/projects/demo/archive`: download an unencrypted ZIP of project file bytes. `POST` a ZIP to the same path to import into the project atomically, add-only. Existing paths reject the entire import.
- `GET /v1/projects/demo/files/src/main.txt`: read a text file.
- For binary files, `PUT` accepts `{"content_base64":"...", "revision":null}`; `GET` returns `content_base64` for binary records. The size limit applies to decoded bytes. Text requests and responses remain compatible.
- `PUT /v1/projects/demo/files/src/main.txt` with `{"content":"hello", "revision":null}`: create; for updates supply the current revision. A successful response contains a new revision. Stale/missing revisions return 409, not an overwrite.
- `DELETE /v1/projects/demo/files/src/main.txt` with `{"revision":"<current revision>"}`: delete if unchanged.

Paths use forward slashes and cannot contain empty, `.` or `..` components, backslashes, control characters or a leading slash. Paths are logical SQLite keys, not host filesystem paths. Files can contain UTF-8 text or binary bytes; directory paths are implicit and empty directories are not stored. ZIP import treats valid UTF-8 without NUL as text and other data as binary; file bytes are preserved, but type classification can change. ZIP metadata such as permissions, timestamps, empty directories and symlinks is not preserved; encrypted archives and symlinks are rejected. Each project is capped at 1,000 files and 50 MiB of UTF-8 content; a file is capped at 700 KiB and JSON request bodies at 1 MiB. ZIP input is capped at 60 MiB compressed, with project/file limits applied to uncompressed data and a 2,000-entry limit including directories. These are application limits, not host disk quotas. Project count is not capped. Only empty projects can be deleted.

## Backups and recovery

The database is `$LINUXHTML_DATA_DIR/workspace.sqlite3` (default `./data/workspace.sqlite3`). These commands use Python's SQLite online backup API to take a consistent backup even while the API is running. The destination must not already exist; parent directories must exist. Files are unencrypted and should be stored in a secure, separately protected location. `backend/backup.py` uses Unix `flock`, and is intended for Linux/Unix self-hosting.

```sh
# Choose an absolute path that does not exist; restrict access to its directory.
python3 backend/backup.py backup --database "$LINUXHTML_DATA_DIR/workspace.sqlite3" --file "$HOME/linuxhtml-backup.sqlite3"

# Stop ALL LinuxHTML backend and dev-server processes first. Restore REPLACES the database.
# Back up the current database separately before restoring.
python3 backend/backup.py restore --database "$LINUXHTML_DATA_DIR/workspace.sqlite3" --file "$HOME/linuxhtml-backup.sqlite3" --confirm-replace
```

Restore validates integrity, schema and file constraints, regenerates file revisions to invalidate stale client edits, then replaces the database using a temporary file in the same directory. It takes a nonblocking exclusive advisory lock and refuses to proceed while another cooperating LinuxHTML server is running. It also refuses when SQLite journal/WAL sidecars exist, to avoid accidentally applying stale transactions. The lock does **not** stop non-LinuxHTML programs that ignore it; ensure every writer is stopped. If sidecars remain, investigate and recover or checkpoint the database with SQLite before retrying; do not blindly delete them. Only restore trusted backups: validation is not malware scanning, authentication, encryption, or a substitute for testing recovery. Restoring replaces all server projects, loses changes made since the backup, and does not affect browser or guest data. Optional systemd timer examples can schedule local rotation; they must be installed/configured by the operator and do not replicate backups off-site. See [server operations](operations.md). Project files stored here are independent of both browser files and temporary VM files; copies are manual, not sync.

## Roadmap and prerequisites

1. **Project API and browser editor:** implemented and tested with a loopback development proxy. Online backup and offline restore are available. Binary content, add-only ZIP transfer, revision-checked file moves and empty-project deletion are available. Add full directory management, database migrations and automated off-site backup.
2. **Alpine guest/image:** an optional pinned official Alpine 3.24.3 x86 live ISO boots and exposes `apk`; a manual 9P mount enables transfers. This is not a LinuxHTML-built installed image, not persistent, not signature-verified by the build, and has no automatic updates. Build an installed guest and define update ownership.
3. **Persistent guest filesystem:** the Alpine live guest has a separate 256 MiB browser-backed ext2 data disk mounted at `/persist`, with manual gzip export/import and cross-tab exclusion. An overlay root entered after login persists ordinary `/etc`, `/home`, `/usr` and `/var` edits; runtime mounts and `/mnt` are temporary. Browser eviction, abrupt shutdown and storage failures can cause loss. Alpine boots from the live ISO rather than an installed root and startup services run before the overlay shell. Buildroot still has manual VM checkpoints. See README for recovery procedures and limits.
4. **Packages and toolchains:** integrate Alpine `apk` and optional toolchains only after networking and image builds work; define repositories, signature checks and storage costs.
5. **Controlled networking:** implement explicit opt-in and relay/proxy policy, test DNS, egress restrictions, abuse and revocation; no default open relay.
6. **Accounts and sync:** implement user authentication, per-user authorization, sessions, conflict-aware client integration, quota, data deletion and recovery; the stage-1 shared token is not an account system.
7. **Remote execution:** design a separately isolated worker service with strict resource limits and network policy, test isolation and abuse resistance. Do not execute arbitrary user code in this API or trust ordinary containers as a complete security boundary.
8. **Monitoring and recovery:** manual and scheduled-local backup tooling, retention, health checks, optional HTTPS failure notifications and guarded restore exist. Timers are examples and are not deployed; add off-site backup, wider service health, retry/recovery notifications and operational recovery drills.

Run regression tests with `python3 -m unittest discover -s tests -p 'test_backend*.py' -v`.

## Desktop project editor

Build the PWA and start the loopback-only development host:

```sh
python3 tools/pack.py --tier base --target pwa
export LINUXHTML_API_TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
python3 backend/dev_server.py
```

Visit `http://127.0.0.1:8766/`, open the launcher and choose **Server projects**. Enter the token from the same shell, connect, and create or select a project. Create paths such as `src/main.txt` and save explicitly. Binary upload is add-only; select a file to download or open/delete it. To move a saved file, open it, change its path and choose Move. ZIP import is atomic and add-only; export downloads an unencrypted archive. Opening a file captures its revision; conflicting updates and deletes are rejected. To move text between server and browser, enter a flat local filename and choose a transfer button. Local copies are add-only. Unsaved server edits prompt on replacement or page unload. The token is kept only in page memory until disconnect or reload, but any same-origin script or extension with sufficient privileges may access it; this is not a security guarantee.

The development host binds to loopback only and is not suitable for public deployment. For a self-hosted HTTPS deployment, serve the PWA and proxy the app-relative `api/` path to the loopback API, stripping the `api/` prefix. For example, for a PWA deployed at `/linuxhtml/`, the reverse proxy must map `/linuxhtml/api/v1/projects` to `http://127.0.0.1:8080/v1/projects`. Preserve authorization headers, cap request sizes, disable caching of API responses, protect secrets and logs, and test routing, TLS and access controls. The application blocks plain HTTP except on localhost. A reverse proxy does not address the service's missing multi-user authorization, rate limiting, operational hardening or security review.

The PWA caches application assets for offline use, but server operations require a live API. No server file or token is intentionally stored in the service-worker cache. There is no background sync, merge, installed guest root filesystem, or production authentication. The default Buildroot VM supports a manual experimental checkpoint; the Alpine live system uses a persistent overlay shell backed by the `/persist` data disk. See README.

See the README section “Optional Alpine VM” for build, login, manual 9P mount, limitations and artifact provenance. The existing default Buildroot build remains unchanged.
