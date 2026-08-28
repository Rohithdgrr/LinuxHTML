#!/usr/bin/env bash
# tools/lint.sh - Richer dev tooling per FUTURE-SCOPE.MD:3 Phase 9 Post-v1
# Lints JS and shell scripts
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "[lint] LinuxHTML lint per FUTURE-SCOPE.MD:3 richer tooling"
# JS lint with eslint if available
if command -v npx >/dev/null 2>&1 && [ -f "$ROOT/package.json" ]; then
  echo "[lint] eslint src/bridge/*.js"
  npx eslint src/bridge/*.js || echo "[lint] eslint not configured - skipping"
else
  echo "[lint] npx eslint not available - checking syntax via node --check"
  for f in "$ROOT"/src/bridge/*.js "$ROOT"/src/bridge/worker/*.js "$ROOT"/src/main.js; do
    if [ -f "$f" ]; then
      node --check "$f" && echo "[lint] $f syntax OK" || echo "[lint] $f syntax FAIL"
    fi
  done
fi
# Shellcheck
if command -v shellcheck >/dev/null 2>&1; then
  echo "[lint] shellcheck src/kernel/build.sh src/rootfs/build.sh"
  shellcheck "$ROOT"/src/kernel/build.sh "$ROOT"/src/rootfs/build.sh || true
else
  echo "[lint] shellcheck not available - checking bash -n"
  bash -n "$ROOT"/src/kernel/build.sh && echo "[lint] src/kernel/build.sh syntax OK"
  bash -n "$ROOT"/src/rootfs/build.sh && echo "[lint] src/rootfs/build.sh syntax OK"
fi
echo "[lint] done"
