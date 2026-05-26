$ErrorActionPreference = "Stop"

$tools = @(
  "node",
  "npm",
  "go",
  "python",
  "uv",
  "docker"
)

$missing = @()

foreach ($tool in $tools) {
  $cmd = Get-Command $tool -ErrorAction SilentlyContinue
  if ($null -eq $cmd) {
    $missing += $tool
  }
}

if ($missing.Count -gt 0) {
  Write-Host "Missing required tools: $($missing -join ', ')"
  exit 1
}

Write-Host "Bootstrap check passed."
