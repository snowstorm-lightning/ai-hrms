$ErrorActionPreference = "Stop"

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
$apiJob = Start-Job -ScriptBlock {
  Set-Location "$using:PSScriptRoot/../apps/api"
  go run ./cmd/server
}
try {
  $ready = $false
  for ($i = 0; $i -lt 30; $i++) {
    try {
      $health = Invoke-RestMethod -Uri "http://localhost:8080/api/health" -TimeoutSec 2
      if ($health.data.status -eq "ok") {
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
  $portLines = netstat -ano | Select-String ":8080"
  foreach ($line in $portLines) {
    $parts = ($line.ToString() -split "\s+") | Where-Object { $_ }
    $processId = [int]$parts[-1]
    if ($processId -gt 0) {
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
  }
}

Write-Host "== Frontend =="
& "$PSScriptRoot/frontend/check.ps1"

Write-Host "== Agent =="
& "$PSScriptRoot/agent/check.ps1"

Write-Host "Project harness check passed."
