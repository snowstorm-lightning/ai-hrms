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

## 2026-05-31 Visual/RAG/LLM Cost Review

- Fixed Visual Copilot UX regression: removed the confusing side-switch control, added draggable/resizable panel behavior, added a movable narrow icon rail, and verified collapsed mode does not block modal input.
- Follow-up Visual Copilot refinement: user-adjusted panel position and size now persist, selection completion no longer forces the panel back to a left/right edge, and the collapsed rail can be moved in both X and Y instead of acting as a fixed edge switch.
- Follow-up Visual Copilot refinement: long-page selection now keeps auto-scrolling while the pointer stays near the viewport edge, and Esc/cancel/close paths reset the capture state and pending scroll loop.
- Follow-up Browser Harness fix: AppShell now exposes a stable `data-suite-mode` marker so desktop/mobile real and demo suites do not depend on responsive header text.
- Follow-up Browser Harness fix: mobile suites now exercise Visual Copilot panel drag, collapse-to-rail, rail drag, expand, and post-expand input focus instead of only opening and closing the panel.
- RAG scope fix: non-global users no longer gain unscoped role-only RAG documents solely by matching a role code; role-scoped knowledge must match the user's concrete legal/entity or org scope, while global users remain covered by the global scope path.
- Visual action boundary fix: Visual Copilot action-preview endpoints now keep `executionMode=action_preview` and `humanReviewRequired=true` even when DeepSeek successfully generates the narrative explanation; LLM text cannot turn a preview path into a normal explain path.
- Python agent boundary fix: DeepSeek chat now refuses calls without scoped citations and rejects internal/restricted or PII/high-impact HR citation payloads; remote embedding providers reject PII/high-impact text, while localhost/local-network embedding endpoints remain available for the local Qwen setup.
- RAG indexing integrity fix: when a non-fake embedding provider is configured, document embedding failures now return explicit errors instead of silently writing fake deterministic vectors; fake vectors remain only for true fake/no-provider demo paths.
- API contract fix: OpenAPI now documents `GET /api/capabilities` with `Capability` and `CapabilityListEnvelope`, matching the Go route and frontend client.
- README delivery fix: native API startup now derives `DATABASE_URL` from `infra/.env` so it matches the Compose PostgreSQL password/port; verification docs now separate core `npm run check` from standalone browser and embedding harnesses.
- Fixed Visual Copilot answer quality path for real mode: selected business objects now flow through scoped Postgres context and safe RAG citations before DeepSeek; the UI still states the text-only/no-image boundary.
- Fixed AI chat program-first routing: employee/organization/legal entity/Agent run status queries now use deterministic SQL responses and avoid DeepSeek/embedding/Agent cost.
- Fixed capability bypass risk: deterministic SQL chat routes require the corresponding module capability, and Visual Copilot business-ref resolution now requires read capability for employee/org/legal, RAG, learning, Agent run, or audit objects.
- Fixed action request routing: write-like AI chat prompts now return tool previews instead of asking DeepSeek to generate pseudo-execution text.
- Fixed RAG weak-match risk: hybrid retrieval filters weak vector/lexical candidates and applies topic guards for compensation, hiring, exit, promotion, and performance queries before forming citations, so irrelevant citations do not get promoted into DeepSeek answers.
- Manual real-mode probe: AI chat now returns SQL-only employee/legal status, tool-preview-only learning assignment, high-impact HR blocking, and `refused_no_citation` for compensation policy without matching evidence.
- Manual Visual Copilot probe: selecting `企鹅企业服务` returns a deterministic scoped Postgres/RAG explanation with clear no-image/no-auto-execution/audit boundaries; DeepSeek is reserved for explicitly routed LLM explain paths.
- Verification: `npm run web:check`, `npm run web:build`, `go test ./apps/api/...`, `./harness/agent/check.sh`, `npm run embedding:check`, and `npm run browser:check` passed after the fixes. Latest browser pass covered real/demo desktop plus real/demo mobile, with demo backend requests at 0 and console/page/request/http errors at 0.
- Follow-up Visual cost/safety fix: synchronous Visual Copilot selections now remain DOM/Postgres/RAG deterministic unless the router explicitly chooses `llm_explain`; action-like selections preserve preview and human-review mode.
- Follow-up RAG privacy fix: Visual RAG queries redact employee/user labels into object-type hints, and Visual LLM prompts skip employee, user, org-manager, Agent run, and audit-event details before any external provider path.
- Follow-up RAG publish fix: RAG rebuild now uses the same publish-scope gate as document creation and ingest, and empty/no-chunk rebuilds fail before accessing embedding metadata.
- Follow-up agent parity fix: Python DeepSeek safety terms now match Go high-impact HR terms for bonus, transfer, exit, salary, compensation, promotion, and performance decisions while still allowing policy explanation with citations.
- Follow-up agent cost fix: `/chat/preview` now rejects citation snippets over 2,000 characters and aggregate citation payloads over 9,000 characters before any DeepSeek call.
- Follow-up harness fix: top-level harnesses use isolated `HARNESS_API_PORT` and refuse to run against an already-listening API; database default port now matches the local dev Postgres port `55432`.
- Follow-up harness fix: empty local `infra/.env` values no longer break `docker compose` interpolation during checks; harness provides local-only defaults for Postgres password, Docker database URL, JWT secret, and CORS.
- Follow-up Visual ergonomics fix: the collapsed rail uses 44px touch targets and remains a movable narrow control rail rather than an edge-switch UI.
- Follow-up Visual scroll fix: selected business-object regions now resync to the current DOM object after window, internal container, horizontal table, or visual viewport scrolling, so the blue box no longer stays pinned to a stale screen location when the object moves.
- Follow-up browser harness fix: Visual Copilot now asserts that a selected business-object region tracks the object after page scroll, catching stale blue-box regressions.
- Verification update: latest `npm run check`, `go test ./apps/api/...`, `npm run web:check`, `npm run web:build`, `./harness/agent/check.sh`, `uv run python -m compileall apps/agent/src`, `npm run embedding:check`, and `npm run browser:check` passed after the follow-up fixes.

## 2026-05-31 Final Visual/Operations Hardening Pass

- Ruthless Visual review found that internal scroll-container selection mixed pseudo scroll coordinates with document coordinates. Fixed by keeping rect selections in document coordinates and preserving the user's original `rect` selection instead of rewriting it to the first business object's full DOM box after scroll.
- Capture mode now keeps keyboard focus inside the Visual Copilot rail on `Tab`; the rail supports keyboard movement, and capture-layer z-index only rises during active selection so business modals remain usable outside capture mode.
- Visual Copilot demo answers now describe selected business objects with object-type-specific business meaning instead of generic "real mode will query" placeholder copy.
- Real seeded demo data is aligned with the fictional company boundary through append-only migration `012_demo_company_naming.sql`; the running database was migrated and the first legal entity now displays `企鹅互联网科技有限公司`.
- Documentation/harness alignment: README and harness READMEs now separate real web `5173`, demo web `5174`, Docker API `8020`, native API `8080`, and isolated harness API `18080`; PowerShell harness no longer starts one API while checking another base URL.
- Browser harness now asserts that real Visual Copilot submit payloads include the exact selected `data-vc-object-type` and `data-vc-object-id`, catching false positives where the UI merely reports `business_ref>0`.
- Local embedding runtime fix: `.env` was corrected locally so DeepSeek remains the chat provider while embeddings use `local-openai-compatible` at `http://127.0.0.1:8082/v1`, model `Qwen3-Embedding-0.6B-Q8_0`, dimensions `1024`; no key values were printed or tracked.
- Go embedding routing now treats `openai-compatible` with localhost/private base URLs as local, so a self-hosted OpenAI-compatible embedding server is not over-classified as an external cloud provider.
- Verification update: `go test ./apps/api/...`, `npm run web:check`, `npm run web:build`, `npm run browser:check`, `./harness/agent/check.sh`, `node --check harness/browser/check.mjs`, shell syntax checks, Python harness compile checks, and `git diff --check` passed after this pass.
- Final harness update: `npm run check` and `npm run embedding:check` passed; the embedding check confirmed local `Qwen3-Embedding-0.6B-Q8_0` returns 1024 dimensions and does not print vectors or keys.
- Follow-up UX/product fix: `/app/help` now provides a product-internal new-user guide with role paths, program-vs-LLM guidance, Visual Copilot usage, and an admin-only section rendered only for `group_admin`.
- Follow-up Visual Copilot fix: no-selection questions now use page-context chat, while selected regions still use Visual Context Resolver; result content appears before execution/context internals, and those internals are collapsed by default.
- Follow-up organization fix: organization units can be deleted only after reference checks pass; API, frontend demo client, OpenAPI, and browser harness now cover close/delete controls. Real-mode smoke created and deleted a temporary org unit successfully.
- Follow-up demo account fix: append-only migration `013_demo_user.sql` adds a local `demo/password` walkthrough user when demo seed data exists; frontend demo display user is also `demo`.
- Latest verification: `npm run web:check`, `npm run web:build`, `go test ./apps/api/...`, `node --check harness/browser/check.mjs`, `npm run browser:check`, and an API create/delete org-unit smoke passed after this pass.

## 2026-06-07 Docs/Attendance/Copilot Follow-up

- Document Library now opens catalog items into dedicated document detail pages. The main page focuses on full-body reading, while the local table of contents and citation/governance status move into left/right drawers.
- Added scoped attendance real-time overview and preview-only attendance Agent analysis. The Agent creates an `attendance_realtime_overview` read-only tool preview and requires human review before any follow-up.
- Visual Copilot answer layout now leads with the direct answer and keeps execution details, context evidence, and trust metadata behind expandable details.
- AI chat has program-first product identity answers, deterministic RAG synthesis for common product/RAG questions, and high-impact HR boundary replies backed by local scoped citations.
- OpenAPI, README, demo guide, demo script, assignment solution, API harness docs, and browser harness docs were updated for the new document detail, attendance overview/analysis, and Visual Copilot answer shape.

## Merge Rule

The orchestrator serially edits shared files and resolves conflicts. Subagents provide focused review and implementation advice; final integration remains centralized.
