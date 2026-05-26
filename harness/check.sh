#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
API_PORT="${API_PORT:-8080}"
export API_BASE_URL="${API_BASE_URL:-http://localhost:${API_PORT}/api}"

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN=python3
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN=python
else
  PYTHON_BIN=
fi

api_pid=""
cleanup() {
  if [[ -n "$api_pid" ]] && kill -0 "$api_pid" >/dev/null 2>&1; then
    kill "$api_pid" >/dev/null 2>&1 || true
    wait "$api_pid" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

wait_for_api() {
  if [[ -z "$PYTHON_BIN" ]]; then
    echo "Missing required tool: python3 or python"
    return 1
  fi

  for _ in $(seq 1 30); do
    if "$PYTHON_BIN" -c "import json, sys, urllib.request; data=json.load(urllib.request.urlopen(sys.argv[1], timeout=2)); sys.exit(0 if data.get('data', {}).get('status') == 'ok' else 1)" "$API_BASE_URL/health" >/dev/null 2>&1; then
      return 0
    fi
    if [[ -n "$api_pid" ]] && ! kill -0 "$api_pid" >/dev/null 2>&1; then
      echo "API process exited before becoming ready."
      return 1
    fi
    sleep 1
  done

  echo "API did not become ready at $API_BASE_URL/health"
  return 1
}

echo "== Bootstrap =="
"$SCRIPT_DIR/bootstrap/check.sh"

echo "== Database =="
"$SCRIPT_DIR/database/check.sh"

echo "== Go API =="
(
  cd "$ROOT/apps/api"
  go test ./...
  go vet ./...
)

echo "== API Harness =="
(
  cd "$ROOT/apps/api"
  go run ./cmd/server
) &
api_pid=$!
wait_for_api
"$SCRIPT_DIR/api/check.sh"
"$SCRIPT_DIR/e2e/check.sh"

echo "== Frontend =="
"$SCRIPT_DIR/frontend/check.sh"

echo "== Agent =="
"$SCRIPT_DIR/agent/check.sh"

echo "Project harness check passed."
