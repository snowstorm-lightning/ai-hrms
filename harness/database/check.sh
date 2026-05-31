#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$ROOT/infra/compose.yaml"
ENV_FILE="$ROOT/infra/.env"
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

if [[ -f "$ENV_FILE" ]]; then
  load_env_file "$ENV_FILE"
fi
export AI_HRMS_ENV="${AI_HRMS_HARNESS_ENV:-test}"
export AI_HRMS_ENABLE_DEMO_SEED="${AI_HRMS_HARNESS_ENABLE_DEMO_SEED:-true}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-ai_hrms}"
export DOCKER_DATABASE_URL="${DOCKER_DATABASE_URL:-postgres://ai_hrms:${POSTGRES_PASSWORD}@postgres:5432/ai_hrms?sslmode=disable}"
export JWT_SECRET="${JWT_SECRET:-harness-dev-secret-change-me}"
export DOCKER_CORS_ALLOWED_ORIGINS="${DOCKER_CORS_ALLOWED_ORIGINS:-http://localhost:5173,http://127.0.0.1:5173}"
export DATABASE_URL="${HARNESS_DATABASE_URL:-postgres://ai_hrms:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT:-55432}/ai_hrms?sslmode=disable}"
compose=(docker compose)
if [[ -f "$ENV_FILE" ]]; then
  compose+=(--env-file "$ENV_FILE")
fi
compose+=(-f "$COMPOSE_FILE")

psql_scalar() {
  local sql="$1"
  "${compose[@]}" exec -T postgres \
    psql -U ai_hrms -d ai_hrms -t -A -c "$sql" | tr -d '[:space:]'
}

(
  cd "$ROOT/apps/api"
  go run ./cmd/migrate
)

tables="$(psql_scalar "select count(*) from information_schema.tables where table_schema='public' and table_name in ('legal_entities','org_units','employees','employee_assignments','users','roles','user_role_bindings','capabilities','audit_events','rag_sources','rag_documents','rag_document_scopes','rag_chunks','rag_embeddings','rag_ingest_jobs','learning_courses','learning_enrollments','agent_runs','agent_tool_calls','visual_copilot_events');")"
if ((tables < 20)); then
  echo "Expected core tables to exist, found $tables."
  exit 1
fi

primary_assignments="$(psql_scalar "select count(*) from employee_assignments where is_primary and end_date is null;")"
if ((primary_assignments < 1)); then
  echo "Expected at least one current primary assignment."
  exit 1
fi

vector_dim="$(psql_scalar "select format_type(atttypid, atttypmod) from pg_attribute where attrelid = 'rag_embeddings'::regclass and attname = 'embedding';")"
if [[ "$vector_dim" != "vector" ]]; then
  echo "Expected rag_embeddings.embedding to support configurable pgvector dimensions, found $vector_dim."
  exit 1
fi

echo "Database check passed."
