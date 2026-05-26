# AI-HRMS

AI-HRMS is a single-company HRMS for one corporate group with multiple
subsidiaries and organization units. The first phase reproduces useful
`../saas_hrms` workflows with a Go API, PostgreSQL, React, Ant Design, and a
separate Python agent boundary managed by `uv`.

## Local Ports

| Service | URL | Notes |
| --- | --- | --- |
| Web | `http://127.0.0.1:5173` | Vite dev server |
| API | `http://localhost:8080/api` | Go service, runs migrations on start |
| Agent | `http://127.0.0.1:8090` | Optional Python placeholder |
| PostgreSQL | `localhost:55432` | Container maps to internal `5432` |

## Prerequisites

- Docker.
- Go.
- Node.js with npm.
- Python 3.12 or newer.
- `uv`.

Run the bootstrap harness to verify local tools:

```powershell
.\harness\bootstrap\check.ps1
```

## Start Locally

Start PostgreSQL:

```powershell
docker compose -f infra/compose.yaml up -d postgres
```

Start the API:

```powershell
Set-Location apps/api
go run ./cmd/server
```

Install web dependencies once, then start the frontend from the repo root:

```powershell
npm install
npm run web:dev
```

Optional agent service:

```powershell
Set-Location apps/agent
uv sync
uv run ai-hrms-agent
```

## Seed Account

| Mobile | Password | Role |
| --- | --- | --- |
| `123` | `password` | Seeded admin user |

## Verification

Run targeted harnesses from the repo root:

```powershell
.\harness\database\check.ps1
.\harness\api\check.ps1
.\harness\frontend\check.ps1
.\harness\agent\check.ps1
```

Additional developer checks:

```powershell
go test ./...
go vet ./...
npm run web:check
npm run web:build
```

## Project Indexes

- Agent-facing index: `AGENT.md`.
- Durable constraints: `docs/constraints/`.
- Architectural decisions: `docs/adr/`.
- API contract index: `packages/openapi/openapi.yaml`.
- Executable verification: `harness/`.
