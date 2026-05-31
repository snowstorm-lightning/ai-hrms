$ErrorActionPreference = "Stop"

$root = Resolve-Path "$PSScriptRoot/.."
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
if ($env:AI_HRMS_HARNESS_REAL_AI -ne "true") {
  $env:AGENT_BASE_URL = ""
  $env:AI_HRMS_AGENT_SERVICE_TOKEN = ""
  $env:DEEPSEEK_API_KEY = ""
  $env:OPENAI_COMPATIBLE_EMBEDDING_API_KEY = ""
  $env:AI_CHAT_PROVIDER = "fake"
  $env:AI_EMBEDDING_PROVIDER = "fake"
}
$apiPort = if ($env:HARNESS_API_PORT) { $env:HARNESS_API_PORT } else { "18080" }
$env:API_PORT = $apiPort
$env:API_BASE_URL = "http://localhost:$apiPort/api"

Write-Host "== Bootstrap =="
& "$PSScriptRoot/bootstrap/check.ps1"

Write-Host "== Database =="
& "$PSScriptRoot/database/check.ps1"

Write-Host "== Go API =="
Push-Location "$PSScriptRoot/../apps/api"
try {
  go test ./...
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  go vet ./...
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}

Write-Host "== API Harness =="
$portBusy = $false
try {
  $client = [System.Net.Sockets.TcpClient]::new()
  $connect = $client.BeginConnect("127.0.0.1", [int]$apiPort, $null, $null)
  $portBusy = $connect.AsyncWaitHandle.WaitOne(300)
  if ($portBusy) { $client.EndConnect($connect) }
  $client.Close()
} catch {
  $portBusy = $false
}
if ($portBusy) {
  throw "Harness API port $apiPort is already in use; refusing to check against an old service. Set HARNESS_API_PORT to a free port."
}
$databaseUrl = $env:DATABASE_URL
$apiAgentBaseUrl = $env:AGENT_BASE_URL
$apiAgentServiceToken = $env:AI_HRMS_AGENT_SERVICE_TOKEN
$apiChatProvider = $env:AI_CHAT_PROVIDER
$apiEmbeddingProvider = $env:AI_EMBEDDING_PROVIDER
$apiEmbeddingDimensions = $env:RAG_EMBEDDING_DIMENSIONS
$apiJob = Start-Job -ScriptBlock {
  Set-Location "$using:PSScriptRoot/../apps/api"
  $env:API_PORT = $using:apiPort
  $env:DATABASE_URL = $using:databaseUrl
  $env:AGENT_BASE_URL = $using:apiAgentBaseUrl
  $env:AI_HRMS_AGENT_SERVICE_TOKEN = $using:apiAgentServiceToken
  $env:AI_CHAT_PROVIDER = $using:apiChatProvider
  $env:AI_EMBEDDING_PROVIDER = $using:apiEmbeddingProvider
  $env:RAG_EMBEDDING_DIMENSIONS = $using:apiEmbeddingDimensions
  go run ./cmd/server
}
try {
  $ready = $false
  for ($i = 0; $i -lt 30; $i++) {
    if ($apiJob.State -ne "Running") {
      throw "API process exited before becoming ready."
    }
    try {
      $health = Invoke-RestMethod -Uri "$env:API_BASE_URL/health" -TimeoutSec 2
      if ($health.data.status -eq "ok") {
        if ($apiJob.State -ne "Running") {
          throw "API health responded but harness API process has exited; refusing to use an old service."
        }
        $ready = $true
        break
      }
    } catch {
      Start-Sleep -Seconds 1
    }
  }
  if (-not $ready) {
    throw "API did not become ready"
  }
  & "$PSScriptRoot/api/check.ps1"
  & "$PSScriptRoot/e2e/check.ps1"
} finally {
  Stop-Job $apiJob -ErrorAction SilentlyContinue
  Remove-Job $apiJob -Force -ErrorAction SilentlyContinue
}

Write-Host "== Frontend =="
& "$PSScriptRoot/frontend/check.ps1"

Write-Host "== Agent =="
& "$PSScriptRoot/agent/check.ps1"

Write-Host "Project harness check passed."
