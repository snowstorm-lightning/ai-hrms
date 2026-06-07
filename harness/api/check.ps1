$ErrorActionPreference = "Stop"

$base = $env:API_BASE_URL
if (-not $base) {
  $base = "http://localhost:8080/api"
}

function Invoke-ApiJson {
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

function Assert-ApiRejected {
  param(
    [string] $Method = "Get",
    [string] $Path,
    [hashtable] $Headers,
    [int[]] $ExpectedStatus,
    [object] $Body = $null
  )

  try {
    Invoke-ApiJson -Method $Method -Path $Path -Headers $Headers -Body $Body | Out-Null
  } catch {
    $status = [int]$_.Exception.Response.StatusCode
    if ($ExpectedStatus -contains $status) {
      return
    }
    throw "Expected $Path to fail with $($ExpectedStatus -join '/'), got $status"
  }
  throw "Expected $Path to be rejected"
}

$health = Invoke-RestMethod -Uri "$base/health"
if ($health.data.status -ne "ok") {
  throw "Health check failed"
}

$loginBody = @{ mobile = "123"; password = "password" } | ConvertTo-Json
$login = Invoke-ApiJson -Method Post -Path "/auth/login" -Body $loginBody
$token = $login.data.token
if (-not $token) {
  throw "Login did not return a token"
}

$headers = @{ Authorization = "Bearer $token" }
$paths = @("/profile", "/legal-entities", "/org-units", "/roles", "/capabilities", "/users", "/employees", "/attendance", "/messages", "/rag/sources", "/rag/documents", "/learning/courses", "/learning/enrollments", "/agent/runs", "/audit/events", "/visual-copilot/events")
foreach ($path in $paths) {
  $response = Invoke-ApiJson -Path $path -Headers $headers
  if ($response.success -ne $true) {
    throw "API smoke failed for $path"
  }
}

$bindings = Invoke-ApiJson -Path "/users/00000000-0000-0000-0000-000000000302/role-bindings" -Headers $headers
if ($bindings.data.Count -lt 1) {
  throw "Expected seeded role bindings"
}
$replaceBindingsBody = @{ bindings = $bindings.data } | ConvertTo-Json -Depth 8
$replacedBindings = Invoke-ApiJson -Method Put -Path "/users/00000000-0000-0000-0000-000000000302/role-bindings" -Headers $headers -Body $replaceBindingsBody
if ($replacedBindings.success -ne $true) {
  throw "Role binding replacement failed"
}

$employeeCsv = Invoke-WebRequest -UseBasicParsing -Uri "$base/employees/export" -Headers $headers
if ($employeeCsv.StatusCode -ne 200 -or $employeeCsv.Headers["Content-Type"] -notmatch "text/csv" -or $employeeCsv.Content.Length -lt 10) {
  throw "员工 export did not return CSV content"
}
$attendanceCsv = Invoke-WebRequest -UseBasicParsing -Uri "$base/attendance/export" -Headers $headers
if ($attendanceCsv.StatusCode -ne 200 -or $attendanceCsv.Headers["Content-Type"] -notmatch "text/csv" -or $attendanceCsv.Content.Length -lt 10) {
  throw "考勤 export did not return CSV content"
}

$attendanceOverview = Invoke-ApiJson -Path "/attendance/overview?day=2026-05-29" -Headers $headers
if ($null -eq $attendanceOverview.data.summary -or $attendanceOverview.data.summary.expected -lt 1) {
  throw "Attendance overview should include expected headcount"
}
if ($null -eq $attendanceOverview.data.orgUnits -or $null -eq $attendanceOverview.data.exceptions) {
  throw "Attendance overview should include orgUnits and exceptions"
}

$attendanceAnalysisBody = @{ day = "2026-05-29"; focus = "overview" } | ConvertTo-Json
$attendanceAnalysis = Invoke-ApiJson -Method Post -Path "/attendance/agent-analysis" -Headers $headers -Body $attendanceAnalysisBody
if ($null -eq $attendanceAnalysis.data.run) {
  throw "Attendance agent analysis should create a run preview"
}
if ($attendanceAnalysis.data.toolPreview.toolName -ne "attendance_realtime_overview") {
  throw "Attendance agent analysis should preview the read-only attendance tool"
}
if ($attendanceAnalysis.data.trustPacket.humanReviewRequired -ne $true) {
  throw "Attendance agent analysis should require human review"
}

$entityLoginBody = @{ mobile = "100112"; password = "password" } | ConvertTo-Json
$entityLogin = Invoke-ApiJson -Method Post -Path "/auth/login" -Body $entityLoginBody
$entityHeaders = @{ Authorization = "Bearer $($entityLogin.data.token)" }

$entityProfile = Invoke-ApiJson -Path "/profile" -Headers $entityHeaders
if ($entityProfile.data.mobile -ne "100112") {
  throw "Scoped profile returned the wrong user"
}

$allowedEmployee = Invoke-ApiJson -Path "/employees/00000000-0000-0000-0000-000000000403" -Headers $entityHeaders
if ($allowedEmployee.success -ne $true) {
  throw "Scoped employee read should succeed"
}

$entityLegalEntities = Invoke-ApiJson -Path "/legal-entities" -Headers $entityHeaders
if ($entityLegalEntities.data.id -contains "00000000-0000-0000-0000-000000000103") {
  throw "Scoped legal entity list leaked an unauthorized legal entity"
}

Assert-ApiRejected -Path "/users" -Headers $entityHeaders -ExpectedStatus @(403)
Assert-ApiRejected -Path "/roles" -Headers $entityHeaders -ExpectedStatus @(403)
Assert-ApiRejected -Method "Post" -Path "/legal-entities" -Headers $entityHeaders -ExpectedStatus @(403) -Body "{}"
Assert-ApiRejected -Path "/employees/00000000-0000-0000-0000-000000000402" -Headers $entityHeaders -ExpectedStatus @(404)
Assert-ApiRejected -Method "Post" -Path "/attendance" -Headers $entityHeaders -ExpectedStatus @(404) -Body (@{ employeeId = "00000000-0000-0000-0000-000000000402"; attendanceStatus = 1 } | ConvertTo-Json)
Assert-ApiRejected -Method "Put" -Path "/attendance/00000000-0000-0000-0000-000000000602/checkout" -Headers $entityHeaders -ExpectedStatus @(404)

$ragSourceBody = @{
  sourceType = "url"
  name = "Harness source $(Get-Date -Format 'yyyyMMddHHmmss')"
  uri = "https://example.com/hr-policy"
} | ConvertTo-Json
$ragSource = Invoke-ApiJson -Method Post -Path "/rag/sources" -Headers $headers -Body $ragSourceBody
if (-not $ragSource.data.id) {
  throw "RAG source creation failed"
}

$ragDocumentBody = @{
  sourceId = $ragSource.data.id
  title = "Harness onboarding policy"
  version = "v1"
  status = "published"
  trustLevel = "official"
  sensitivity = "normal"
  content = "Onboarding employees must finish policy learning in 7 days and manager review in 30 days."
  scopes = @(@{ scopeType = "global"; includeDescendants = $true })
} | ConvertTo-Json -Depth 8
$ragDocument = Invoke-ApiJson -Method Post -Path "/rag/documents" -Headers $headers -Body $ragDocumentBody
if (-not $ragDocument.data.id) {
  throw "RAG document creation failed"
}

$ingestJob = Invoke-ApiJson -Method Post -Path "/rag/ingest-jobs" -Headers $headers -Body (@{
  jobType = "ingest"
  title = "Harness direct ingestion"
  content = "Direct ingestion supports uploaded text, local directory sources, and URL sources through the same job API."
  scopes = @(@{ scopeType = "global"; includeDescendants = $true })
} | ConvertTo-Json -Depth 8)
if (-not $ingestJob.data.documentId) {
  throw "RAG ingestion job should materialize a document"
}

$ragSearch = Invoke-ApiJson -Method Post -Path "/rag/search" -Headers $entityHeaders -Body (@{ query = "Onboarding"; limit = 5 } | ConvertTo-Json)
if ($ragSearch.data.citations.Count -lt 1) {
  throw "Scoped RAG search should return citations"
}

$chat = Invoke-ApiJson -Method Post -Path "/ai/chat" -Headers $entityHeaders -Body (@{ message = "What should onboarding finish in 7 days?" } | ConvertTo-Json)
if ($chat.data.citations.Count -lt 1) {
  throw "AI chat did not return citation-grounded response"
}

$run = Invoke-ApiJson -Method Post -Path "/agent/runs" -Headers $headers -Body (@{ runType = "data_quality"; prompt = "Check assignment data"; riskLevel = "low" } | ConvertTo-Json)
if (-not $run.data.id) {
  throw "Agent run creation failed"
}

$toolPreview = Invoke-ApiJson -Method Post -Path "/agent/tools/preview" -Headers $headers -Body (@{ runId = $run.data.id; toolName = "list_employees"; arguments = @{} } | ConvertTo-Json -Depth 8)
if ($toolPreview.data.accepted -ne $true) {
  throw "Read-only agent tool preview should be accepted"
}
Assert-ApiRejected -Method "Post" -Path "/agent/tools/preview" -Headers $headers -ExpectedStatus @(400) -Body (@{ userId = "00000000-0000-0000-0000-000000000301"; toolName = "list_employees"; arguments = @{} } | ConvertTo-Json -Depth 8)

$visualAllowedBody = @{
  route = "/app/employees"
  viewport = @{ width = 1280; height = 720; scrollX = 0; scrollY = 0 }
  dom = @(@{ kind = "table-row"; objectType = "employee"; objectId = "00000000-0000-0000-0000-000000000403" })
  regions = @(@{
    id = "r1"
    mode = "rect"
    rect = @{ x = 1; y = 1; width = 20; height = 20; dpr = 1 }
    businessRefs = @(@{ type = "employee"; id = "00000000-0000-0000-0000-000000000403"; label = "林晨" })
  })
  instruction = "Explain this employee row"
} | ConvertTo-Json -Depth 10
$visual = Invoke-ApiJson -Method Post -Path "/visual-copilot/suggestions" -Headers $entityHeaders -Body $visualAllowedBody
if (-not $visual.data.event.id) {
  throw "Visual Copilot suggestion should create an event"
}

$visualRejectedBody = @{
  route = "/app/employees"
  viewport = @{ width = 1280; height = 720; scrollX = 0; scrollY = 0 }
  dom = @()
  regions = @(@{
    id = "r2"
    mode = "rect"
    rect = @{ x = 1; y = 1; width = 20; height = 20; dpr = 1 }
    businessRefs = @(@{ type = "employee"; id = "00000000-0000-0000-0000-000000000402"; label = "陈向南" })
  })
  instruction = "Explain unauthorized employee"
} | ConvertTo-Json -Depth 10
Assert-ApiRejected -Method "Post" -Path "/visual-copilot/suggestions" -Headers $entityHeaders -ExpectedStatus @(403) -Body $visualRejectedBody

$audit = Invoke-ApiJson -Path "/audit/events" -Headers $headers
if ($audit.data.total -lt 1) {
  throw "Expected audit events after AI/RAG/Visual operations"
}

Write-Host "API smoke check passed."
