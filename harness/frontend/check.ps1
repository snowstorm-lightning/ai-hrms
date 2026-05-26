$ErrorActionPreference = "Stop"

$root = Resolve-Path "$PSScriptRoot/../.."
Push-Location $root
try {
  npm run web:check
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  npm run web:build
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}

Write-Host "Frontend check passed."
