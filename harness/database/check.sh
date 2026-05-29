#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$ROOT/infra/compose.yaml"

psql_scalar() {
  local sql="$1"
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
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
