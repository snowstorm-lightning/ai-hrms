# AI-HRMS

AI-HRMS is a Human-Agent Symbiotic HR Operating System: it connects
organization data, governed knowledge, learning growth, agent runs, human
review, and audit evidence so HR teams and AI agents can work together inside
traceable boundaries.

It still preserves the practical single-company HRMS foundation for one
corporate group with subsidiaries and organization units. The implementation
uses a Go API, PostgreSQL/pgvector, React, Ant Design, and a separate Python
agent boundary managed by `uv`.

## Assignment Demo: AI-HRMS

Submission positioning:

AI-HRMS｜人机共生的人力资源智能操作系统

The assignment demo presents the full AI-HRMS product, not a standalone
Co-Growth demo. Co-Growth OS is one highlighted module inside AI-HRMS: the
growth engine for AI literacy, work missions, reflection, and evidence.

Demo company boundary: AI-HRMS is the product. `企鹅互联网科技有限公司` is only a
fictional seeded demo company dataset used to make HR workflows concrete; it is
not Tencent, is not affiliated with Tencent, and does not represent real company
data.

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

When narrating this path, describe any company names, employee records, policies,
or citations as simulated company data for the AI-HRMS product demo.

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
export AI_HRMS_ENV='development'
export AI_HRMS_ENABLE_DEMO_SEED=true
export JWT_SECRET='dev-secret-change-me'
export API_PORT=8080
export CORS_ALLOWED_ORIGINS='http://localhost:5173,http://127.0.0.1:5173'
export AGENT_BASE_URL='http://127.0.0.1:8090'
export AI_HRMS_AGENT_SERVICE_TOKEN='<same-token-as-agent-when-real-provider-is-enabled>'
go run ./cmd/server
```

Windows PowerShell:

```powershell
Set-Location apps/api
$env:DATABASE_URL = "postgres://ai_hrms:ai_hrms@localhost:55432/ai_hrms?sslmode=disable"
$env:AI_HRMS_ENV = "development"
$env:AI_HRMS_ENABLE_DEMO_SEED = "true"
$env:JWT_SECRET = "dev-secret-change-me"
$env:API_PORT = "8080"
$env:CORS_ALLOWED_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
$env:AGENT_BASE_URL = "http://127.0.0.1:8090"
$env:AI_HRMS_AGENT_SERVICE_TOKEN = "<same-token-as-agent-when-real-provider-is-enabled>"
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
pixel-level vision understanding.

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
```

`harness/api` and `harness/e2e` expect the API to already be running unless you
use the top-level `npm run check`, which starts and stops a temporary API
process.

`harness/browser` expects real and demo web servers to be running. It uses the
local Playwright package and Playwright-managed Chromium cache; a system Chrome
or Chromium binary is optional.

## Project Indexes

- Agent-facing index: `AGENT.md`.
- Durable constraints: `docs/constraints/`.
- Architectural decisions: `docs/adr/`.
- API contract index: `packages/openapi/openapi.yaml`.
- Executable verification: `harness/`.
