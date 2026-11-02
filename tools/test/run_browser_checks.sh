#!/usr/bin/env bash
# CI smoke tests for the shipped Buildroot PWA. Requires playwright-cli and Chromium.
set -euo pipefail
cd "$(dirname "$0")/../.."
python3 -m http.server 8765 --bind 127.0.0.1 --directory build/pwa >build/browser-test-server.log 2>&1 &
server_pid=$!
cleanup() {
  playwright-cli -s=arena close >/dev/null 2>&1 || true
  kill "$server_pid" >/dev/null 2>&1 || true
}
trap cleanup EXIT
# A failed bind must not accidentally test another server.
curl --silent --show-error --fail --retry 10 --retry-connrefused --retry-delay 1 http://127.0.0.1:8765/ >/dev/null
kill -0 "$server_pid"
playwright-cli -s=arena open http://127.0.0.1:8765/ --browser=chromium
for test in desktop workspace file_manager notes calculator developer learning terminal startup_recovery mobile settings backup; do
  echo "::group::Browser test: $test"
  timeout 180s playwright-cli -s=arena run-code "$(cat "tools/test/${test}_browser.js")"
  echo "::endgroup::"
done
