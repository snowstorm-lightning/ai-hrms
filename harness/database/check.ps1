$ErrorActionPreference = "Stop"

Push-Location "$PSScriptRoot/../../apps/api"
try {
  go run ./cmd/migrate
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}

$tables = docker compose -f infra/compose.yaml exec -T postgres psql -U ai_hrms -d ai_hrms -t -c "select count(*) from information_schema.tables where table_schema='public' and table_name in ('legal_entities','org_units','employees','employee_assignments','users','roles','user_role_bindings','capabilities','audit_events','rag_sources','rag_documents','rag_document_scopes','rag_chunks','rag_embeddings','rag_ingest_jobs','learning_courses','learning_enrollments','agent_runs','agent_tool_calls','visual_copilot_events');"
$count = [int](($tables | Where-Object { $_.Trim() -match '^\d+$' } | Select-Object -First 1).Trim())
if ($count -lt 20) {
  throw "Expected core tables to exist, found $count."
}

$primaryAssignments = docker compose -f infra/compose.yaml exec -T postgres psql -U ai_hrms -d ai_hrms -t -c "select count(*) from employee_assignments where is_primary and end_date is null;"
$primaryCount = [int](($primaryAssignments | Where-Object { $_.Trim() -match '^\d+$' } | Select-Object -First 1).Trim())
if ($primaryCount -lt 1) {
  throw "Expected at least one current primary assignment."
}

$vectorDim = docker compose -f infra/compose.yaml exec -T postgres psql -U ai_hrms -d ai_hrms -t -c "select format_type(atttypid, atttypmod) from pg_attribute where attrelid = 'rag_embeddings'::regclass and attname = 'embedding';"
$dimValue = (($vectorDim | Where-Object { $_.Trim() -ne "" } | Select-Object -First 1).Trim())
if ($dimValue -ne "vector(8)") {
  throw "Expected rag_embeddings.embedding vector dimension metadata to be 8."
}

Write-Host "Database check passed."
