$ErrorActionPreference = "Stop"

$root = Resolve-Path "$PSScriptRoot/../.."
Push-Location $root
try {
  node harness/browser/check.mjs
} finally {
  Pop-Location
}

Write-Host "Browser harness check passed."
