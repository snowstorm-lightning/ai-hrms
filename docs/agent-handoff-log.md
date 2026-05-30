# Agent Handoff Log

## Historical 2026-05-29 Phase 0 Findings

Executive Orchestrator established the AI-HRMS submission target and read the mandated frontend, API, backend, SQL, OpenAPI, README, AGENT, and constraints files.

## Explorer Results

- Documentation Director: docs still center on Co-Growth; README demo mode is buried; assignment solution and demo script must be rewritten around AI-HRMS.
- Frontend Director: Co-Growth is the strongest AI-native surface; Dashboard/Login/Knowledge/Agent/Audit still feel like traditional admin pages; trust metadata needs a shared vocabulary.
- API/Demo Director: demo mode is partial; core review path needs broader mocks or disabled/friendly demo placeholders; Go/SQL already support early trust-layer primitives.

## Active P0 Work

- Completed: Login and Dashboard now present AI-HRMS as the full submission.
- Completed: AI Command, Knowledge, Agent Runs, and Audit now act as system-level AI-HRMS surfaces.
- Completed: Co-Growth is positioned as the growth engine and linked from the main operating-system narrative.
- Completed: demo mode mocks cover the core review path and common side paths, including dynamic audit events.
- Completed: assignment solution, demo script, README, AI-HRMS demo guide, review matrix, and module appendix were rewritten.

## Risks

- Residual: visual density can still be improved, but P0 review path is stable.
- Mitigated: production RAG now has PostgreSQL/pgvector configurable embeddings and vector-first retrieval through the Go API.
- Mitigated: DeepSeek chat runs through Python agent boundary; provider secrets stay in local `.env` or deployment secrets, not tracked files.
- Mitigated: Co-Growth no longer acts as the only demo entry or submission subject.
- Mitigated: `企鹅互联网科技有限公司` is documented as a fictional seeded demo company dataset/business dataset for AI-HRMS, not Tencent or real HR data; seed data now uses neutral fictional departments such as 协同产品、企业服务、风险策略 and 增长策略.

## 2026-05-29 P2 Implementation

- Completed: DeepSeek OpenAI-compatible chat provider in the Python agent.
- Completed: OpenAI-compatible embedding provider endpoint in the Python agent.
- Completed: Go `agentbridge` client; Go keeps RBAC/scope/audit and sends only scoped chunks/citations to the agent.
- Completed: `rag_embeddings.embedding` migration from fixed `vector(8)` to configurable `vector`.
- Completed: Knowledge Hub has an ingest-job UI and provider status is visible in the shell.
- Completed: Docker Compose wires API to agent boundary while keeping provider keys off the API service.
- Completed: Python LangGraph workflow demo is exposed through Go as `/api/agent/workflows/langgraph/demo`.
- Completed: Dashboard uses `@ant-design/charts` for operating signals.
- Review fix: real RAG excludes restricted/PII-like sensitivities before citations reach the agent.
- Review fix: real `/api/ai/chat` now writes audit events and blocks high-risk HR decision prompts.

## Verification

- `npm run web:check`: passed.
- `npm run web:build`: passed.
- `go test ./...` in `apps/api`: passed.
- `./harness/agent/check.sh`: passed.
- `rg -n 'sk-[A-Za-z0-9]{20,}' ... --glob '!.env'`: no tracked key-like values found.
- Browser review with `VITE_DEMO_MODE=true`: `/login`, `/app/dashboard`, `/app/ai-command`, `/app/knowledge`, `/co-growth`, `/app/learning`, `/app/agents`, `/app/audit` loaded with zero console errors, zero `/api` requests, and zero failed requests.
- Dynamic trust loop verified: AI Command creates an audit event visible in Audit Center.
- Mobile navigation verified: dashboard opens controlled navigation drawer.

## 2026-05-30 Follow-Up Review

- Browser review in real API mode covered `/login`, `/app/dashboard`, `/app/ai-command`, `/app/knowledge`, `/co-growth`, `/app/learning`, `/app/agents`, and `/app/audit`: zero console errors and zero failed requests.
- Found and fixed `/app/audit` horizontal overflow caused by long table content.
- Found and fixed Visual Copilot panel visibility and close affordance; panel now opens compactly, header and close button are visible, and `Esc` closes it.
- Found and fixed Visual Copilot DOM explanation quality; DOM-only context is marked `unverified_client_hint`, while database business refs remain the trusted evidence path.
- Security review added SSRF protections for URL ingestion, external embedding gates for sensitive HR text, and mandatory agent service token for non-fake providers.

## 2026-05-30 Documentation Boundary Pass

- Clarified that AI-HRMS is the product and `企鹅互联网科技有限公司` is simulated company/business data only.
- Aligned 3-minute demo narration so company names, employees, policies, citations, and audit events are described as fictional demo data, not Tencent or any real company's data.
- Rechecked key configuration, DeepSeek text-only Visual Copilot boundary, and PostgreSQL/pgvector RAG wording across the scoped docs.

## 2026-05-30 Browser Harness Pass

- Added `harness/browser` using the local Playwright package and Playwright-managed Chromium cache; system Chromium is optional.
- Verified current environment: Playwright package is installed, Playwright Chromium cache exists, and `chromium`/`google-chrome` wrappers are available on PATH.
- Browser harness covers `/login`, `/app/dashboard`, `/app/ai-command`, `/app/knowledge`, `/co-growth`, `/app/learning`, `/app/agents`, `/app/audit`, and Visual Copilot open/close.
- Latest `npm run browser:check` passed in real mode and demo mode; demo mode made 0 backend API requests and produced 0 console/page errors.
- Follow-up fix: the browser harness now dynamically loads Playwright, reports the actual Chromium executable, catches HTTP 4xx/5xx responses, and treats configured backend origins plus `/api` paths as forbidden in demo mode.
- API harness labels now use the Penguin fictional company data (`林晨`, `陈向南`) instead of old seed names.
- Migration fix: published `002_seed.sql` and `004_ai_native.sql` were restored to immutable contents; Penguin sample data remains in append-only `006_penguin_company_seed.sql`.
- Production bootstrap fix: added `ai-hrms-admin bootstrap-admin --password-stdin`, an `infra/compose.yaml` profile service, and `008_system_roles.sql` so production deployments with demo seed disabled can create the first `group_admin`.

## Merge Rule

The orchestrator serially edits shared files and resolves conflicts. Subagents provide focused review and implementation advice; final integration remains centralized.
