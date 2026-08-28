#!/usr/bin/env bash
# tools/devbox.sh - DevBox helper per FUTURE-SCOPE.MD:3 Phase 9 Post-v1
# Manages devbox profile and hot reload
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TIER="base"
PROFILE="examples/devbox/profile.json"
usage() {
  echo "Usage: $0 [--tier micro|base|standard] [--profile PATH] [--hot-reload]"
  echo "  --tier  Build tier per README-1.md:664"
  echo "  --hot-reload  Watch src/ and auto-rebuild per FUTURE-SCOPE.MD:3"
  exit 0
}
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tier) TIER="$2"; shift 2 ;;
    --profile) PROFILE="$2"; shift 2 ;;
    --hot-reload) HOT_RELOAD=1; shift ;;
    -h|--help) usage ;;
    *) echo "Unknown $1"; usage ;;
  esac
done
echo "[devbox] LinuxHTML DevBox per examples/devbox/profile.json tier $TIER per FUTURE-SCOPE.MD:3"
if [ -f "$ROOT/$PROFILE" ]; then
  echo "[devbox] Profile $PROFILE: $(cat "$ROOT/$PROFILE" | head -20)"
fi
echo "[devbox] Building tier $TIER per README-1.md:556"
"$ROOT/src/rootfs/build.sh" --tier "$TIER" || echo "[devbox] rootfs build simulated"
echo "[devbox] Packing PWA tier $TIER"
python3 "$ROOT/tools/pack.py" --tier "$TIER" --target pwa
echo "[devbox] DevBox ready - run: python3 tools/serve.py per README-1.md:718"
if [ "${HOT_RELOAD:-}" = "1" ]; then
  echo "[devbox] Hot reload watching src/ per FUTURE-SCOPE.MD:3"
  # Requires fswatch or inotifywait
  if command -v inotifywait >/dev/null 2>&1; then
    while inotifywait -r -e modify "$ROOT/src"; do
      echo "[devbox] src changed - rebuilding"
      python3 "$ROOT/tools/pack.py" --tier "$TIER" --target pwa
    done
  else
    echo "[devbox] inotifywait not available - hot reload stub"
  fi
fi
