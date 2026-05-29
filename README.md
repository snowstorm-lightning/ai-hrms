# AI-HRMS

AI-HRMS is a single-company HRMS for one corporate group with multiple
subsidiaries and organization units. The first phase reproduces useful
`../saas_hrms` workflows with a Go API, PostgreSQL, React, Ant Design, and a
separate Python agent boundary managed by `uv`.

## Assignment Demo: AI-HRMS

Submission positioning:

AI-HRMS｜人机共生的人力资源智能操作系统

The assignment demo presents the full AI-HRMS product, not a standalone
Co-Growth demo. Co-Growth OS is one highlighted module inside AI-HRMS: the
growth engine for AI literacy, work missions, reflection, and evidence.

Run the deterministic frontend demo:

```bash
VITE_DEMO_MODE=true npm run web:dev
```

Open `http://127.0.0.1:5173/login` and click **一键进入 AI-HRMS Demo**.
The core demo path does not require Go, PostgreSQL, Python, external LLMs, or
external network calls.

Recommended 3-minute path:

1. `/app/dashboard` - AI-HRMS Command Dashboard and Demo Tour.
2. `/app/ai-command` - structured HR recommendation with trust metadata.
3. `/app/knowledge` - governed RAG documents, trust level, sensitivity, scope,
   and citation preview.
4. `/co-growth` - Co-Growth OS as the AI-HRMS growth engine.
5. `/app/agents` - human-agent run cards, tool preview, and confirmation.
6. `/app/audit` - trust, audit, and evidence chain.

Build the public demo:

```bash
VITE_DEMO_MODE=true npm run web:build
```

See:

- `docs/assignment-five-solution.md`
- `docs/demo-script.md`
- `docs/ai-hrms-demo.md`

## Local Ports

| Service | URL | Notes |
| --- | --- | --- |
| Docker Web | `http://127.0.0.1:8021` | Built React app served by container Nginx |
| Docker API | `http://127.0.0.1:8020/api` | Go service, runs migrations on start |
| Native Web | `http://127.0.0.1:5173` | Vite dev server |
| Native API | `http://localhost:8080/api` | Go dev process |
| Native Agent | `http://127.0.0.1:8090` | Python AI/RAG provider boundary |
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

For real AI mode, put `DEEPSEEK_API_KEY` and embedding provider keys in
`infra/.env`. Compose passes provider keys only to the Python agent service;
the Go API talks to the agent over `AGENT_BASE_URL` and keeps RBAC, scope, and
audit control.

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
export AGENT_BASE_URL='http://127.0.0.1:8090'
go run ./cmd/server
```

Windows PowerShell:

```powershell
Set-Location apps/api
$env:DATABASE_URL = "postgres://ai_hrms:ai_hrms@localhost:55432/ai_hrms?sslmode=disable"
$env:JWT_SECRET = "dev-secret-change-me"
$env:API_PORT = "8080"
$env:CORS_ALLOWED_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
$env:AGENT_BASE_URL = "http://127.0.0.1:8090"
go run ./cmd/server
```

For local smoke tests without external calls, start the Python agent boundary in
fake mode:

```bash
cd apps/agent
AI_CHAT_PROVIDER=fake AI_EMBEDDING_PROVIDER=fake uv run ai-hrms-agent
```

For real AI/RAG mode, set the provider env vars on the Python agent process
before starting it. Keep keys in local env files or deployment secrets only and
do not commit them:

```bash
export AI_CHAT_PROVIDER=deepseek
export DEEPSEEK_API_KEY='<your-deepseek-api-key>'
export DEEPSEEK_BASE_URL='https://api.deepseek.com'
export DEEPSEEK_CHAT_MODEL='deepseek-v4-flash'
export DEEPSEEK_REASONING_EFFORT='high'
export DEEPSEEK_TIMEOUT_SECONDS=30
export AI_EMBEDDING_PROVIDER=openai-compatible
export OPENAI_COMPATIBLE_EMBEDDING_API_KEY='<your-embedding-api-key>'
export OPENAI_COMPATIBLE_EMBEDDING_BASE_URL='<embedding-base-url>'
export OPENAI_COMPATIBLE_EMBEDDING_MODEL='<embedding-model>'
export RAG_EMBEDDING_DIMENSIONS='<embedding-dimensions>'
```

DeepSeek chat uses an OpenAI-compatible Chat Completions API. RAG retrieval is
vector-first through PostgreSQL/pgvector; embeddings are configured separately
with `AI_EMBEDDING_PROVIDER` and `OPENAI_COMPATIBLE_EMBEDDING_*`. The Go API
keeps authorization, scope filtering, and audit; the agent only receives scoped
chunks/citations and provider calls.

The P2 workflow demo is available through Go at
`POST /api/agent/workflows/langgraph/demo`, which proxies the Python LangGraph
boundary after normal authentication/capability checks.

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

Optional AI-HRMS pure frontend demo:

```bash
VITE_DEMO_MODE=true npm run web:dev
```

Then open `http://127.0.0.1:5173/login` and enter the AI-HRMS demo from the
login page. The demo mode keeps the existing Go API path available when
`VITE_DEMO_MODE` is unset or `false`, but uses deterministic frontend data for
the full AI-HRMS review path.

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
