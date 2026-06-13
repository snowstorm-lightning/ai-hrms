# AI-HRMS

AI-HRMS is a Human-Agent Symbiotic HR Operating System: it connects
organization data, governed knowledge, learning growth, agent runs, human
review, and audit evidence so HR teams and AI agents can work together inside
traceable boundaries.

It preserves practical organization data, role/scope control, audit, and HR
workflow records as the operating-system data layer. The implementation uses a
Go API, PostgreSQL/pgvector, React, Ant Design, and a separate Python agent
boundary managed by `uv`.

## Product Scope

AI-HRMS is positioned as `人机共生的人力资源智能操作系统`. It focuses on
turning HRMS from a record system into an operating layer where HR workflows,
governed knowledge, AI recommendations, agent runs, and human review share the
same permission, trust, and audit model.

Core product areas:

1. Command dashboard for scoped organization status and operational signals.
2. AI command center for explainable HR recommendations with trust metadata.
3. Governed knowledge and RAG document flows with scope, sensitivity, and
   citation controls.
4. Attendance cockpit with exception drill-down and human-reviewed AI analysis.
5. Co-Growth OS for AI literacy, work missions, reflection, and evidence.
6. Agent run management with tool previews, confirmations, and audit records.

## Quick Frontend Preview

Run the deterministic frontend preview:

```bash
npm run web:dev:demo
```

Open `http://127.0.0.1:5174/login` and use the one-click entry on the login
page. This preview mode does not require Go, PostgreSQL, Python, external LLMs,
or external network calls.

Build the frontend preview:

```bash
VITE_DEMO_MODE=true npm run web:build
```

See:

- `docs/assignment-five-solution.md`
- `docs/assignment-five-reviewer-guide.md`
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
AI_HRMS_ENV=production
AI_HRMS_ENABLE_DEMO_SEED=false
VITE_API_BASE_URL=/api
DOCKER_CORS_ALLOWED_ORIGINS=https://hrms.snowstormlightning.top
```

For real AI mode, put `DEEPSEEK_API_KEY` and embedding provider keys in
`infra/.env`. Compose passes provider keys only to the Python agent service;
the Go API talks to the agent over `AGENT_BASE_URL` and keeps RBAC, scope, and
audit control. If you use the optional local embedding service, start Compose
with `--profile embedding` and set
`OPENAI_COMPATIBLE_EMBEDDING_BASE_URL=http://embedding:80/v1` for containers.

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

### Create First Production Admin

When `AI_HRMS_ENABLE_DEMO_SEED=false`, the local demo account does not exist.
Create the first production `group_admin` with the one-shot bootstrap service:

```bash
read -rsp 'Bootstrap admin password: ' BOOTSTRAP_ADMIN_PASSWORD; echo
printf '%s' "$BOOTSTRAP_ADMIN_PASSWORD" | docker compose --env-file infra/.env -f infra/compose.yaml run --rm -T bootstrap-admin \
  --mobile '+8613800000000' \
  --name 'Platform Admin' \
  --password-stdin
unset BOOTSTRAP_ADMIN_PASSWORD
```

Use a real organization-controlled login and a strong one-time password. The
command runs migrations, creates or updates that user, grants global
`group_admin`, and writes a bootstrap audit event. Remove the password from
shell history or terminal scrollback if your environment records commands.

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

Nginx reverse proxy steps are in `docs/deploy-nginx.md`. Generic cloud server
and private registry CI/CD steps are in `docs/deploy-cloud-registry.md`.

## Start Natively

Create `infra/.env` before using the native PostgreSQL/API examples because
they read `POSTGRES_PASSWORD` and `POSTGRES_PORT` from that file:

```bash
cp infra/.env.example infra/.env
```

You may also copy the root `.env.example` to `.env` as a local reference file,
but export the variables in the shell that starts each service. The Go API does
not auto-load `.env`, and Vite only reads variables prefixed with `VITE_`.

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
set -a
source infra/.env
set +a
export DATABASE_URL="postgres://ai_hrms:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT:-55432}/ai_hrms?sslmode=disable"
export AI_HRMS_ENV='development'
export AI_HRMS_ENABLE_DEMO_SEED=true
export JWT_SECRET='dev-secret-change-me'
export API_PORT=8080
export CORS_ALLOWED_ORIGINS='http://localhost:5173,http://127.0.0.1:5173'
export AGENT_BASE_URL='http://127.0.0.1:8090'
export AI_HRMS_AGENT_SERVICE_TOKEN='<same-token-as-agent-when-real-provider-is-enabled>'
cd apps/api
go run ./cmd/server
```

Windows PowerShell:

```powershell
$infra = Get-Content infra/.env | Where-Object { $_ -match "^[A-Za-z_][A-Za-z0-9_]*=" } | ConvertFrom-StringData
$postgresPort = if ($infra.POSTGRES_PORT) { $infra.POSTGRES_PORT } else { "55432" }
$env:DATABASE_URL = "postgres://ai_hrms:$($infra.POSTGRES_PASSWORD)@localhost:$postgresPort/ai_hrms?sslmode=disable"
$env:AI_HRMS_ENV = "development"
$env:AI_HRMS_ENABLE_DEMO_SEED = "true"
$env:JWT_SECRET = "dev-secret-change-me"
$env:API_PORT = "8080"
$env:CORS_ALLOWED_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
$env:AGENT_BASE_URL = "http://127.0.0.1:8090"
$env:AI_HRMS_AGENT_SERVICE_TOKEN = "<same-token-as-agent-when-real-provider-is-enabled>"
Set-Location apps/api
go run ./cmd/server
```

For local smoke tests without external calls, start the Python agent boundary in
fake mode:

```bash
cd apps/agent
AI_CHAT_PROVIDER=fake AI_EMBEDDING_PROVIDER=fake uv run ai-hrms-agent
```

For real AI/RAG mode, set the provider env vars on the Python agent process
before starting it. The Go API must use the same `AI_HRMS_AGENT_SERVICE_TOKEN`
and provider metadata so routing and safety checks match the agent. Keep keys in
local env files or deployment secrets only and do not commit them:

```bash
export AGENT_BASE_URL='http://127.0.0.1:8090'               # Go API only
export AI_HRMS_AGENT_SERVICE_TOKEN='<openssl-rand-hex-32>' # Go API and agent
export AI_CHAT_PROVIDER=deepseek
export DEEPSEEK_API_KEY='<your-deepseek-api-key>'          # agent only
export DEEPSEEK_BASE_URL='https://api.deepseek.com'
export DEEPSEEK_CHAT_MODEL='deepseek-v4-flash'
export DEEPSEEK_REASONING_EFFORT='high'
export DEEPSEEK_TIMEOUT_SECONDS=30
export AI_EMBEDDING_PROVIDER=local-openai-compatible
export OPENAI_COMPATIBLE_EMBEDDING_API_KEY='<your-embedding-api-key>'
export OPENAI_COMPATIBLE_EMBEDDING_BASE_URL='<embedding-base-url>'
export OPENAI_COMPATIBLE_EMBEDDING_MODEL='<embedding-model>'
export RAG_EMBEDDING_DIMENSIONS='<embedding-dimensions>'
```

Windows PowerShell:

```powershell
$env:AGENT_BASE_URL = "http://127.0.0.1:8090"               # Go API only
$env:AI_HRMS_AGENT_SERVICE_TOKEN = "<openssl-rand-hex-32>" # Go API and agent
$env:AI_CHAT_PROVIDER = "deepseek"
$env:DEEPSEEK_API_KEY = "<your-deepseek-api-key>"           # agent only
$env:DEEPSEEK_BASE_URL = "https://api.deepseek.com"
$env:DEEPSEEK_CHAT_MODEL = "deepseek-v4-flash"
$env:DEEPSEEK_REASONING_EFFORT = "high"
$env:DEEPSEEK_TIMEOUT_SECONDS = "30"
$env:AI_EMBEDDING_PROVIDER = "local-openai-compatible"
$env:OPENAI_COMPATIBLE_EMBEDDING_API_KEY = "<your-embedding-api-key>"
$env:OPENAI_COMPATIBLE_EMBEDDING_BASE_URL = "<embedding-base-url>"
$env:OPENAI_COMPATIBLE_EMBEDDING_MODEL = "<embedding-model>"
$env:RAG_EMBEDDING_DIMENSIONS = "<embedding-dimensions>"
```

Recommended local CPU embedding setup for a 4C/4GB host:

```bash
docker compose --profile embedding --env-file infra/.env -f infra/compose.yaml up -d embedding
```

Then set the agent/API embedding variables to:

```bash
export AI_EMBEDDING_PROVIDER=local-openai-compatible
export OPENAI_COMPATIBLE_EMBEDDING_API_KEY='local-no-auth'
export OPENAI_COMPATIBLE_EMBEDDING_BASE_URL='http://127.0.0.1:8082/v1' # native agent
export OPENAI_COMPATIBLE_EMBEDDING_MODEL='Qwen3-Embedding-0.6B-Q8_0'
export RAG_EMBEDDING_DIMENSIONS=1024
```

Inside Docker Compose, use `http://embedding:80/v1` instead of
`http://127.0.0.1:8082/v1` because the agent container reaches the embedding
service through the Compose network. Validate the endpoint with:

```bash
npm run embedding:check
```

Environment matrix:

| Variable | API | Agent | Production rule |
| --- | --- | --- | --- |
| `AI_HRMS_ENV` | required | optional | `production` for public deployments |
| `AI_HRMS_ENABLE_DEMO_SEED` | required | no | `false` in production; `true` only for local/demo seed data |
| `AI_HRMS_AGENT_SERVICE_TOKEN` | required for real providers | required for real providers | same random value on both services |
| `AI_CHAT_PROVIDER` | required | required | `deepseek` for DeepSeek LLM calls, `fake` for deterministic mode |
| `DEEPSEEK_API_KEY` | no | required for `AI_CHAT_PROVIDER=deepseek` | never commit or package `.env` |
| `AI_EMBEDDING_PROVIDER` | required | required | `local-openai-compatible` for local llama.cpp, `openai-compatible` for cloud providers, `fake` for deterministic mode |
| `OPENAI_COMPATIBLE_EMBEDDING_API_KEY` | no | required for real embeddings | never commit or package `.env` |
| `OPENAI_COMPATIBLE_EMBEDDING_BASE_URL` | metadata only | required URL | must be an `http(s)` URL, not an API key |
| `OPENAI_COMPATIBLE_EMBEDDING_MODEL` | metadata only | required model name | must be a model name, not an API key |
| `RAG_EMBEDDING_DIMENSIONS` | required | required | must match provider output exactly |

DeepSeek chat uses an OpenAI-compatible Chat Completions API. RAG retrieval uses
PostgreSQL full-text/lexical candidates plus pgvector candidates with RRF
fusion; embeddings are configured separately with `AI_EMBEDDING_PROVIDER` and
`OPENAI_COMPATIBLE_EMBEDDING_*`. The Go API keeps authorization, scope
filtering, and audit; the agent only receives scoped chunks/citations and
provider calls. Reranking is not enabled in the current build; it is documented
as a future bounded retrieval stage in `docs/rag-chunking.md`.

Use `local-openai-compatible` when the embedding endpoint is self-hosted inside
the trusted deployment boundary. Use `openai-compatible` for cloud embedding
providers; the Go API blocks internal/restricted/high-impact text before sending
it to those external providers. See `docs/local-embedding.md` for the llama.cpp
Qwen3 profile and CPU sizing notes.

Visual Copilot in the DeepSeek setup is text-only: it uses DOM hints, route
context, verified business-object references, scope checks, and audit records.
Screenshots are not sent to DeepSeek, and the demo does not claim image OCR or
pixel-level vision understanding. The browser harness also fails if Visual
Copilot sends `data:image`, base64 screenshots, image content types, multipart
uploads, or a `screenshot` payload.

Recent governed surfaces:

- `GET /api/rag/documents/{id}` returns one scoped RAG document for the
  dedicated document reader. The reader keeps the full body in the main page
  and moves the local table of contents plus citation/governance metadata into
  drawers.
- `GET /api/attendance/overview` returns scoped attendance aggregates,
  organization summaries, exception queues, and recent records for the real-time
  attendance cockpit.
- `POST /api/attendance/agent-analysis` creates a preview-only
  `attendance_realtime_analyst` run and `attendance_realtime_overview` tool
  preview. It is a read-only analysis path and always keeps HR follow-up behind
  human review.
- Visual Copilot answers now present the direct answer first, with execution
  details, context packet, and evidence collapsed behind a details control. DOM
  table row hints can include visible headers/cells, while verified business
  references still come from Go scope checks.

The P2 workflow demo is available through Go at
`POST /api/agent/workflows/langgraph/demo`, which proxies the Python LangGraph
boundary after normal authentication/capability checks.

Install web dependencies once, then start the frontend from the repo root.

Linux/WSL:

```bash
npm ci
VITE_API_BASE_URL=http://localhost:8080/api npm run web:dev:real
```

Windows PowerShell:

```powershell
$env:VITE_API_BASE_URL = "http://localhost:8080/api"
npm ci
npm run web:dev:real
```

Optional AI-HRMS pure frontend demo:

```bash
npm run web:dev:demo
```

Then open `http://127.0.0.1:5174/login` and enter the AI-HRMS demo from the
login page. Real mode uses the Go API when `VITE_DEMO_MODE` is unset or
`false`; `npm run web:dev:demo` enables the deterministic frontend demo and
must not send backend requests during the review path.

Pre-submission secret checklist:

- Do not commit or package `.env`, `infra/.env`, `apps/api/.env`,
  `apps/agent/.env`, or `apps/web/.env`.
- Run a secret scan before committing; only `.env.example` files should contain
  placeholders.
- Rotate any key that was pasted into the wrong variable or displayed in a
  terminal/session log.
- Keep public deployments HTTPS-only; HTTP origins are for localhost or private
  development tunnels only.

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

## Local Demo Seed Account

Only available when `AI_HRMS_ENABLE_DEMO_SEED=true`. Do not enable or use this
account in production.

| Mobile | Password | Role |
| --- | --- | --- |
| `123` | `password` | Seeded admin user |
| `demo` | `password` | Seeded walkthrough user for product demos |

## Verification

Run the core local harnesses from the repo root. This covers database/API/frontend/agent checks that can manage their own local processes.

```bash
npm run check
```

Run targeted harnesses from the repo root when the corresponding services are already running.

Linux/WSL:

```bash
./harness/database/check.sh
./harness/api/check.sh
./harness/frontend/check.sh
./harness/browser/check.sh
./harness/agent/check.sh
```

Windows PowerShell:

```powershell
.\harness\database\check.ps1
.\harness\api\check.ps1
.\harness\frontend\check.ps1
.\harness\browser\check.ps1
.\harness\agent\check.ps1
```

Additional developer checks:

```bash
go test ./...
go vet ./...
npm run web:check
npm run web:build
npm run browser:check
npm run embedding:check
```

`harness/api` and `harness/e2e` expect the API to already be running unless you
use the top-level `npm run check`, which starts and stops a temporary API
process.

`harness/browser` expects the API plus real and demo web servers to be running.
It uses the local Playwright package and Playwright-managed Chromium cache; a
system Chrome or Chromium binary is optional.

Useful harness environment variables:

- `HARNESS_API_PORT`: temporary API port used by `npm run check` /
  `harness/check.sh`; default `18080` so it does not collide with Docker API
  `8020` or native API `8080`.
- `HARNESS_DATABASE_URL`: database URL used by harness migration/check flows;
  when unset it is derived from `infra/.env` values `POSTGRES_PASSWORD` and
  `POSTGRES_PORT`, defaulting to password `ai_hrms` and port `55432`.
- `AI_HRMS_HARNESS_REAL_AI=true`: opt the top-level temporary API harness into
  real provider routing. The default top-level harness mode clears provider keys
  and uses deterministic fake AI; the focused agent unit harness remains fake so
  it can run without external calls.

`npm run embedding:check` is intentionally standalone because it needs an
OpenAI-compatible embedding endpoint such as the local Qwen/llama.cpp service.
It prints provider/model/dimensions only and never prints vectors or keys.

## Project Indexes

- Agent-facing index: `AGENT.md`.
- Durable constraints: `docs/constraints/`.
- Architectural decisions: `docs/adr/`.
- API contract index: `packages/openapi/openapi.yaml`.
- Executable verification: `harness/`.
