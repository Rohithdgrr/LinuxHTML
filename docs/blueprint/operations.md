# Self-hosted server operations (experimental)

These tools cover the **server project SQLite database only**. They do not back up browser IndexedDB, the VM guest, notes stored only in the browser, configuration, or secrets. Backups and archives are unencrypted. Store them in an access-controlled directory and arrange separate encrypted/off-site backups and recovery drills. This is not an independently audited production operations stack.

## Scheduled backup and retention

`backend/operations.py backup` creates a consistent SQLite online backup, verifies it, and atomically publishes it under a unique name. It then deletes older **regular files matching its exact managed naming pattern**, keeping the requested number; unrelated files and symbolic links are not pruned. Retention runs only after a new backup was successfully verified and published. A cooperative directory lock rejects overlapping rotations. New snapshots are mode 0600; the operator must restrict the backup directory and check free space.

```sh
python3 backend/operations.py backup \
  --database "$LINUXHTML_DATA_DIR/workspace.sqlite3" \
  --backup-dir "$HOME/linuxhtml-backups" --keep 7
```

The backup directory must already exist. The output is JSON; a nonzero exit code means creation or retention failed. A newly created backup may exist even if a later pruning operation fails. Backups are validated but not encrypted, authenticated, automatically replicated, or independently protected against host compromise. Deleting browser storage does not affect these files, and deleting these files does not affect browser storage.

## Health checks and notifications

```sh
python3 backend/operations.py monitor \
  --database "$LINUXHTML_DATA_DIR/workspace.sqlite3" \
  --backup-dir "$HOME/linuxhtml-backups" --max-age-hours 48 --min-free-mib 256
```

The command checks SQLite `quick_check`, reads aggregate project/file counts and stored-byte totals, checks free space in both directories, validates the newest managed backup, and checks its age. It prints JSON and exits 0 when all checks pass, or 1 for a detected failure. It does not confirm that the API, web proxy, guest VM or network is reachable, and validation is not a substitute for a restore test. Attach the exit code to an existing monitoring system.

To send failures to an administrator-configured **HTTPS** webhook, set an environment variable containing the URL and pass its name via `--alert-url-env`. The receiver must accept JSON with `event` and `report` fields; this generic payload is not automatically compatible with Slack or other vendor-specific formats. Redirects and URLs with embedded user credentials are rejected. The webhook contains aggregate health values and alert messages, not file contents or project names. It is sent on each failing run, has a 10-second timeout, has no retry or recovery notification, and the command still exits nonzero. Limit who can read the environment file, use TLS, and ensure infrastructure logs do not record the URL. Systemd environment variables are not a strong secret store.

```sh
export LINUXHTML_ALERT_URL='https://monitor.example.invalid/webhook' # replace with your trusted receiver
python3 backend/operations.py monitor \
  --database "$LINUXHTML_DATA_DIR/workspace.sqlite3" \
  --backup-dir "$HOME/linuxhtml-backups" --alert-url-env LINUXHTML_ALERT_URL
```

## Example systemd timers

`deploy/systemd/` contains example `linuxhtml-backup` and `linuxhtml-monitor` service/timer pairs. **They are not installed or enabled by this project.** Review and adapt the `User`, `Group`, executable, database, backup directory, thresholds and sandbox paths for your host. The configured user must read the database and write the backup directory. Ensure `/etc/linuxhtml/monitor.env`, if used, is readable only by the appropriate administrator/service account and contains a trusted `LINUXHTML_ALERT_URL`. Set up the backup directory first and confirm the command runs manually. After reviewing, install the four files under your host's systemd unit directory, run `systemctl daemon-reload`, and explicitly enable/start both timers. Inspect `systemctl list-timers` and the units' journals, test a failing check and webhook, and regularly test restore on a separate database. `Persistent=true` catches missed calendar events but is not an off-site backup or a guarantee against every failure.

The unit files were checked with `systemd-analyze verify`; they have **not** been installed or exercised under a live systemd service in this environment.

## Restore

Use the guarded offline restore described in [self-hosted backend](self-hosted-backend.md). Stop all cooperating server processes, preserve a separate copy of the current database, choose a trusted backup, and use the explicit replacement flag. File revisions change on restore so stale clients cannot silently overwrite restored files. The restore lock cannot stop programs that ignore it. Keep independent, protected copies and rehearse recovery.
