$ErrorActionPreference = "Stop"

$root = Resolve-Path "$PSScriptRoot/../.."
$infraEnv = Join-Path $root "infra/.env"
if (Test-Path $infraEnv) {
  Get-Content $infraEnv | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
    $key, $value = $_ -split '=', 2
    $key = $key.Trim()
    $value = $value.Trim().Trim('"').Trim("'")
    if ($key) { [Environment]::SetEnvironmentVariable($key, $value, "Process") }
  }
}
$env:AI_HRMS_ENV = if ($env:AI_HRMS_HARNESS_ENV) { $env:AI_HRMS_HARNESS_ENV } else { "test" }
$env:AI_HRMS_ENABLE_DEMO_SEED = if ($env:AI_HRMS_HARNESS_ENABLE_DEMO_SEED) { $env:AI_HRMS_HARNESS_ENABLE_DEMO_SEED } else { "true" }
$pgPassword = if ($env:POSTGRES_PASSWORD) { $env:POSTGRES_PASSWORD } else { "ai_hrms" }
$env:POSTGRES_PASSWORD = $pgPassword
$env:DOCKER_DATABASE_URL = if ($env:DOCKER_DATABASE_URL) { $env:DOCKER_DATABASE_URL } else { "postgres://ai_hrms:$pgPassword@postgres:5432/ai_hrms?sslmode=disable" }
$env:JWT_SECRET = if ($env:JWT_SECRET) { $env:JWT_SECRET } else { "harness-dev-secret-change-me" }
$env:DOCKER_CORS_ALLOWED_ORIGINS = if ($env:DOCKER_CORS_ALLOWED_ORIGINS) { $env:DOCKER_CORS_ALLOWED_ORIGINS } else { "http://localhost:5173,http://127.0.0.1:5173" }
$pgPort = if ($env:POSTGRES_PORT) { $env:POSTGRES_PORT } else { "55432" }
$env:DATABASE_URL = if ($env:HARNESS_DATABASE_URL) { $env:HARNESS_DATABASE_URL } else { "postgres://ai_hrms:$pgPassword@localhost:$pgPort/ai_hrms?sslmode=disable" }
$composeFile = Join-Path $root "infra/compose.yaml"
$composeArgs = @("compose")
if (Test-Path $infraEnv) {
  $composeArgs += @("--env-file", $infraEnv)
}
$composeArgs += @("-f", $composeFile)

Push-Location "$root/apps/api"
try {
  go run ./cmd/migrate
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}

$tables = & docker @composeArgs exec -T postgres psql -U ai_hrms -d ai_hrms -t -c "select count(*) from information_schema.tables where table_schema='public' and table_name in ('legal_entities','org_units','employees','employee_assignments','users','roles','user_role_bindings','capabilities','audit_events','rag_sources','rag_documents','rag_document_scopes','rag_chunks','rag_embeddings','rag_ingest_jobs','learning_courses','learning_enrollments','agent_runs','agent_tool_calls','visual_copilot_events');"
$count = [int](($tables | Where-Object { $_.Trim() -match '^\d+$' } | Select-Object -First 1).Trim())
if ($count -lt 20) {
  throw "Expected core tables to exist, found $count."
}

$primaryAssignments = & docker @composeArgs exec -T postgres psql -U ai_hrms -d ai_hrms -t -c "select count(*) from employee_assignments where is_primary and end_date is null;"
$primaryCount = [int](($primaryAssignments | Where-Object { $_.Trim() -match '^\d+$' } | Select-Object -First 1).Trim())
if ($primaryCount -lt 1) {
  throw "Expected at least one current primary assignment."
}

$vectorDim = & docker @composeArgs exec -T postgres psql -U ai_hrms -d ai_hrms -t -c "select format_type(atttypid, atttypmod) from pg_attribute where attrelid = 'rag_embeddings'::regclass and attname = 'embedding';"
$dimValue = (($vectorDim | Where-Object { $_.Trim() -ne "" } | Select-Object -First 1).Trim())
if ($dimValue -ne "vector") {
  throw "Expected rag_embeddings.embedding to support configurable pgvector dimensions."
}

Write-Host "Database check passed."
