#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
load_env_file() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  local line key value
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# || "$line" != *=* ]] && continue
    key="${line%%=*}"
    value="${line#*=}"
    key="$(printf '%s' "$key" | xargs)"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
    export "$key=$value"
  done < "$file"
}

if [[ -f "$ROOT/infra/.env" ]]; then
  load_env_file "$ROOT/infra/.env"
fi
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-ai_hrms}"
export DOCKER_DATABASE_URL="${DOCKER_DATABASE_URL:-postgres://ai_hrms:${POSTGRES_PASSWORD}@postgres:5432/ai_hrms?sslmode=disable}"
export JWT_SECRET="${JWT_SECRET:-harness-dev-secret-change-me}"
export DOCKER_CORS_ALLOWED_ORIGINS="${DOCKER_CORS_ALLOWED_ORIGINS:-http://localhost:5173,http://127.0.0.1:5173}"
export DATABASE_URL="${HARNESS_DATABASE_URL:-postgres://ai_hrms:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT:-55432}/ai_hrms?sslmode=disable}"
if [[ "${AI_HRMS_HARNESS_REAL_AI:-false}" != "true" ]]; then
  unset DEEPSEEK_API_KEY OPENAI_COMPATIBLE_EMBEDDING_API_KEY
  export AI_CHAT_PROVIDER=fake
  export AI_EMBEDDING_PROVIDER=fake
fi
API_PORT="${HARNESS_API_PORT:-18080}"
export API_PORT
export API_BASE_URL="http://localhost:${API_PORT}/api"

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
    if [[ -n "$api_pid" ]] && ! kill -0 "$api_pid" >/dev/null 2>&1; then
      echo "API process exited before becoming ready."
      return 1
    fi
    if "$PYTHON_BIN" -c "import json, sys, urllib.request; data=json.load(urllib.request.urlopen(sys.argv[1], timeout=2)); sys.exit(0 if data.get('data', {}).get('status') == 'ok' else 1)" "$API_BASE_URL/health" >/dev/null 2>&1; then
      if [[ -n "$api_pid" ]] && ! kill -0 "$api_pid" >/dev/null 2>&1; then
        echo "API health responded but harness API process has exited; refusing to use an old service."
        return 1
      fi
      return 0
    fi
    sleep 1
  done

  echo "API did not become ready at $API_BASE_URL/health"
  return 1
}

port_in_use() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$API_PORT" -sTCP:LISTEN -t >/dev/null 2>&1
  else
    "$PYTHON_BIN" - "$API_PORT" <<'PY' >/dev/null 2>&1
import socket, sys
sock = socket.socket()
try:
    sys.exit(0 if sock.connect_ex(("127.0.0.1", int(sys.argv[1]))) == 0 else 1)
finally:
    sock.close()
PY
  fi
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
if port_in_use; then
  echo "Harness API port $API_PORT is already in use; refusing to check against an old service. Set HARNESS_API_PORT to a free port."
  exit 1
fi
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
