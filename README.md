# AI-HRMS

AI-HRMS is a single-company HRMS for one corporate group with multiple
subsidiaries and organization units. The first phase reproduces useful
`../saas_hrms` workflows with a Go API, PostgreSQL, React, Ant Design, and a
separate Python agent boundary managed by `uv`.

## Local Ports

| Service | URL | Notes |
| --- | --- | --- |
| Docker Web | `http://127.0.0.1:8021` | Built React app served by container Nginx |
| Docker API | `http://127.0.0.1:8020/api` | Go service, runs migrations on start |
| Native Web | `http://127.0.0.1:5173` | Vite dev server |
| Native API | `http://localhost:8080/api` | Go dev process |
| PostgreSQL | Docker network only by default | Use `infra/compose.dev.yaml` to publish `127.0.0.1:55432` |

## Prerequisites

For Docker-based local development:

- Docker with Docker Compose v2.

For native local development and harness checks:

- Go 1.26 or newer.
- Node.js 20.19 or newer, or Node.js 22.12 or newer, with npm.
- Python 3.12 or newer.
- `uv`.

On WSL/Linux, the current user must be able to access the Docker daemon. Verify
with `docker ps` before starting the database.

Run the bootstrap harness to verify local tools.

Linux/WSL:

```bash
./harness/bootstrap/check.sh
```

Windows PowerShell:

```powershell
.\harness\bootstrap\check.ps1
```

## Start With Docker

Docker Compose can build and run PostgreSQL, the Go API, the React web app,
and the Python agent service. The default Compose file is deployment-oriented:
PostgreSQL and the agent are not published to the host, while API and Web bind
only to `127.0.0.1` for an external Nginx reverse proxy.

Create the deployment env file:

```bash
cp infra/.env.example infra/.env
openssl rand -hex 24
openssl rand -hex 32
```

Use the first value as `POSTGRES_PASSWORD` and the second as `JWT_SECRET`.
Set `DOCKER_DATABASE_URL` with the same PostgreSQL password, for example:

```dotenv
POSTGRES_PASSWORD=<hex-24>
DOCKER_DATABASE_URL=postgres://ai_hrms:<hex-24>@postgres:5432/ai_hrms?sslmode=disable
JWT_SECRET=<hex-32>
VITE_API_BASE_URL=/api
DOCKER_CORS_ALLOWED_ORIGINS=http://hrms.snowstormlightning.top,https://hrms.snowstormlightning.top
```

Start the stack:

```bash
docker compose --env-file infra/.env -f infra/compose.yaml up -d --build
```

Then check the local targets that Nginx will proxy:

```bash
curl -I http://127.0.0.1:8021
curl -i http://127.0.0.1:8020/api/health
```

The API Docker image has a healthcheck for `/api/health`, so Web waits for API
health before starting.

Stop the stack:

```bash
docker compose --env-file infra/.env -f infra/compose.yaml down
```

Equivalent npm shortcuts:

```bash
npm run docker:up
npm run docker:logs
npm run docker:down
```

Ports bind to `127.0.0.1` by default; set `DOCKER_BIND_IP=0.0.0.0` only if you
intentionally need other machines to reach the local stack directly. Vite
variables are baked into the static web image at build time, so rebuild after
changing `VITE_API_BASE_URL` or `VITE_DEMO_MODE`.

If you have already initialized PostgreSQL with an old password, changing
`POSTGRES_PASSWORD` will not update the existing database user. For a new local
deployment with no data to keep, rebuild the volume:

```bash
docker compose --env-file infra/.env -f infra/compose.yaml down -v
docker compose --env-file infra/.env -f infra/compose.yaml up -d --build
```

Nginx reverse proxy steps are in `docs/deploy-nginx.md`.

## Start Natively

Copy `.env.example` to `.env` if you want a local reference file, but export the
variables in the shell that starts each service. The Go API does not auto-load
`.env`, and Vite only reads variables prefixed with `VITE_`.

Start PostgreSQL and wait for it to become healthy:

```bash
docker compose --env-file infra/.env -f infra/compose.yaml -f infra/compose.dev.yaml up -d postgres
until docker compose --env-file infra/.env -f infra/compose.yaml -f infra/compose.dev.yaml exec -T postgres pg_isready -U ai_hrms -d ai_hrms; do sleep 1; done
```

Windows PowerShell:

```powershell
docker compose --env-file infra/.env -f infra/compose.yaml -f infra/compose.dev.yaml up -d postgres
do {
  Start-Sleep -Seconds 1
  docker compose --env-file infra/.env -f infra/compose.yaml -f infra/compose.dev.yaml exec -T postgres pg_isready -U ai_hrms -d ai_hrms
} until ($LASTEXITCODE -eq 0)
```

Start the API.

Linux/WSL:

```bash
cd apps/api
export DATABASE_URL='postgres://ai_hrms:ai_hrms@localhost:55432/ai_hrms?sslmode=disable'
export JWT_SECRET='dev-secret-change-me'
export API_PORT=8080
export CORS_ALLOWED_ORIGINS='http://localhost:5173,http://127.0.0.1:5173'
go run ./cmd/server
```

Windows PowerShell:

```powershell
Set-Location apps/api
$env:DATABASE_URL = "postgres://ai_hrms:ai_hrms@localhost:55432/ai_hrms?sslmode=disable"
$env:JWT_SECRET = "dev-secret-change-me"
$env:API_PORT = "8080"
$env:CORS_ALLOWED_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
go run ./cmd/server
```

Install web dependencies once, then start the frontend from the repo root.

Linux/WSL:

```bash
npm ci
VITE_API_BASE_URL=http://localhost:8080/api npm run web:dev
```

Windows PowerShell:

```powershell
$env:VITE_API_BASE_URL = "http://localhost:8080/api"
npm ci
npm run web:dev
```

Optional Co-Growth pure frontend demo:

```bash
VITE_DEMO_MODE=true npm run web:dev
```

Then open `http://127.0.0.1:5173/co-growth`. The demo mode keeps the
existing Go API path available when `VITE_DEMO_MODE` is unset or `false`, but
uses deterministic frontend data for the Co-Growth experience.

Optional agent service.

Linux/WSL:

```bash
cd apps/agent
uv sync
uv run ai-hrms-agent
```

Windows PowerShell:

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

Run all local harnesses from the repo root:

```bash
npm run check
```

Run targeted harnesses from the repo root.

Linux/WSL:

```bash
./harness/database/check.sh
./harness/api/check.sh
./harness/frontend/check.sh
./harness/agent/check.sh
```

Windows PowerShell:

```powershell
.\harness\database\check.ps1
.\harness\api\check.ps1
.\harness\frontend\check.ps1
.\harness\agent\check.ps1
```

Additional developer checks:

```bash
go test ./...
go vet ./...
npm run web:check
npm run web:build
```

`harness/api` and `harness/e2e` expect the API to already be running unless you
use the top-level `npm run check`, which starts and stops a temporary API
process.

## Project Indexes

- Agent-facing index: `AGENT.md`.
- Durable constraints: `docs/constraints/`.
- Architectural decisions: `docs/adr/`.
- API contract index: `packages/openapi/openapi.yaml`.
- Executable verification: `harness/`.
