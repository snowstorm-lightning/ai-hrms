$ErrorActionPreference = "Stop"

$base = $env:API_BASE_URL
if (-not $base) {
  $base = "http://localhost:8080/api"
}

function Invoke-E2EJson {
  param(
    [string] $Method = "Get",
    [string] $Path,
    [hashtable] $Headers = @{},
    [object] $Body = $null
  )

  $params = @{
    Method = $Method
    Uri = "$base$Path"
    Headers = $Headers
  }
  if ($null -ne $Body) {
    $params.Body = $Body
    $params.ContentType = "application/json"
  }
  Invoke-RestMethod @params
}

$adminLogin = Invoke-E2EJson -Method Post -Path "/auth/login" -Body (@{ mobile = "123"; password = "12345678900" } | ConvertTo-Json)
$adminHeaders = @{ Authorization = "Bearer $($adminLogin.data.token)" }

$profile = Invoke-E2EJson -Path "/profile" -Headers $adminHeaders
if ($profile.data.mobile -ne "123") {
  throw "E2E profile failed"
}

$entities = Invoke-E2EJson -Path "/legal-entities" -Headers $adminHeaders
$orgUnits = Invoke-E2EJson -Path "/org-units" -Headers $adminHeaders
$employees = Invoke-E2EJson -Path "/employees" -Headers $adminHeaders
$attendance = Invoke-E2EJson -Path "/attendance" -Headers $adminHeaders
$messages = Invoke-E2EJson -Path "/messages" -Headers $adminHeaders
$learning = Invoke-E2EJson -Path "/learning/courses" -Headers $adminHeaders
$knowledge = Invoke-E2EJson -Path "/rag/documents" -Headers $adminHeaders

if ($entities.data.Count -lt 1 -or $orgUnits.data.Count -lt 1 -or $employees.data.total -lt 1) {
  throw "E2E HRMS data workflow failed"
}
if ($null -eq $attendance.data.total -or $null -eq $messages.data.total) {
  throw "E2E activity workflow failed"
}
if ($learning.data.total -lt 1 -or $knowledge.data.total -lt 1) {
  throw "E2E AI-native data workflow failed"
}

$ai = Invoke-E2EJson -Method Post -Path "/ai/chat" -Headers $adminHeaders -Body (@{ message = "Onboarding" } | ConvertTo-Json)
if ($ai.data.citations.Count -lt 1) {
  throw "E2E AI chat should include citations"
}

Write-Host "E2E check passed."
