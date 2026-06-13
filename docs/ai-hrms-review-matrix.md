# AI-HRMS Review Matrix

| Surface | Review Standard | Round 1 Finding | Fix Status |
| --- | --- | --- | --- |
| Login | 10 seconds to understand AI-HRMS and enter demo | Co-Growth direct CTA could confuse the submission subject | Fixed: AI-HRMS is the only primary demo entry |
| Dashboard | Modern AI SaaS command entry, demo tour, role value | Needed to stop looking like org-count admin | Fixed: Command Dashboard, tour, workflow, roles, trust snapshot |
| AI Command | Scenario workbench with evidence, risk, tool preview, audit | Too close to chat answer plus decorations | Fixed: HR Scenario Workbench, decision gate, unified risk policy |
| Knowledge | Governed RAG hub with trust, sensitivity, scope, citation preview | Restricted docs could appear as normal citations | Fixed: high-risk query uses safe citation and marks restricted policy as review-only |
| Document Library | Long governed documents should not crowd the app shell | Detail view used side panels that squeezed reading and metadata together | Fixed: catalog opens a dedicated detail page; TOC and citation/governance status use drawers |
| Attendance | Organization data layer should feel operational, not just a table | Attendance was a flat record table with weak AI-native value | Fixed: real-time cockpit, scoped overview API, exception drill-down, and preview-only Agent analysis |
| Co-Growth | AI-HRMS growth engine, not whole product | Strong module could dominate narrative | Fixed: title and docs position it as growth engine |
| Agent Runs | Run cards, delegated context, tool preview, confirmation, audit | Static run log risk | Fixed: cards, tool preview, human confirmation and dynamic audit events |
| Audit | Evidence chain, blocked high-risk items, human review | Static audit rows weakened trust loop | Fixed: demo actions append audit events |
| Learning | Learning as AI-HRMS layer and Co-Growth entry | Mostly LMS table | Fixed: positioning updated; Co-Growth entry remains as module path |
| Demo Mode | No backend dependency on core path; no console errors | Partial mock risk | Fixed for core and common side paths; browser pass shows 0 `/api` requests |
| Docs | AI-HRMS is submission subject | Co-Growth-first docs remained | Fixed: assignment, script, README, demo guide, module appendix |
| Demo Company Boundary | AI-HRMS is product; demo company dataset is fictional data | Company naming could be confused with real enterprise data | Mitigated: runtime copy states `云衡互联网科技有限公司（虚构样本组织）`; legacy 006 seed text is corrected by append-only migration 012 |
| P2 Real AI/RAG | DeepSeek-compatible provider plumbing and pgvector RAG foundation are deployable without leaking keys | Provider config existed but no real boundary or vector retrieval | Fixed: Python agent provider adapters, Go agentbridge, pgvector configurable embeddings, `.env` ignored |
| P2 Workflow/Charts | LangGraph demo and charting are real code paths, not static claims | Optional P2 items could look unfinished | Fixed: Python LangGraph workflow endpoint and Dashboard `@ant-design/charts` operating signals |
| Browser Harness | Playwright/Chromium status and route smoke checks are reproducible | Browser review was manual and temporary artifacts could leak | Fixed: `harness/browser` verifies package/cache/system Chromium status, route smoke, Visual Copilot, and demo backend isolation |
| Browser Mobile Depth | Mobile Visual Copilot should exercise interaction, not just open/close | Mobile suite only checked FAB visibility and panel close | Fixed: mobile suites now drag panel, collapse to rail, drag rail, expand, and verify input focus |
| Migration Integrity | Published migrations are immutable; new demo data is append-only | `002/004` had been rewritten for Yunheng data and could checksum-fail old databases | Fixed: restored `002/004`, locked checksums in tests, kept Yunheng data in `006`, and added narrow repair for known pre-release seed checksums |
| Production Bootstrap | Production with demo seed disabled still has a first-admin path | `AI_HRMS_ENABLE_DEMO_SEED=false` left no login user | Fixed: `ai-hrms-admin bootstrap-admin` one-shot CLI, Docker Compose bootstrap profile, and system roles migration |
| Repository Narrative | Agent-facing docs must not pull work back to traditional HRMS reproduction | `AGENT.md` and product constraints still said single-company HRMS/reproduction | Fixed: AI-HRMS operating-system positioning is now primary; source project is historical reference only |
| RAG Scope Safety | Published knowledge must have explicit scope and safe embedding routing | Empty scopes could become global published documents | Fixed: unscoped docs are quarantined to draft/internal, 010 migration repairs existing rows, and store tests cover fail-closed normalization |
| Browser Harness Depth | Visual Copilot should be exercised, not only opened | Harness only opened/closed panel and used broad text matching | Fixed: harness now submits a selection, asserts no-image boundary with stable markers, clears selection, and blocks demo `/api` requests before side effects |
| Visual Copilot Ergonomics | Panel should be movable, resizable, and collapsible without blocking work | Fixed panels and side-switch controls made selection confusing and blocked modal input | Fixed: draggable/resizable panel, movable narrow rail, no side-switch button, modal input regression covered by harness |
| Visual Copilot Free Layout | User-adjusted panel/rail position should stay under user control | Selection completion still snapped the panel to a fixed left/right edge and rail only moved vertically | Fixed: panel layout persists, selection no longer edge-snaps the panel, rail moves freely in X/Y, long-page capture auto-scroll is reset safely |
| Visual Copilot Answer Shape | Business answer should lead, internals should not dominate | Execution packet and context internals could overpower the actual answer | Fixed: direct answer first; details, context evidence, and trust packet are expandable |
| Visual Scroll Semantics | Selected boxes should continue to point at the selected business object after scrolling | Business-object selections could look stale after internal container or horizontal table scroll | Fixed: region boxes resync to their current `data-vc-object-*` DOM element on window/container/visual viewport scroll and resize |
| RAG/LLM Cost Routing | Simple structured queries should not call DeepSeek or Agent | AI chat could spend model calls on list/status questions and action-like prompts | Fixed: deterministic SQL routes for status/list queries, tool-preview short circuit for actions, weak RAG candidate filtering plus topic guards before LLM |
| Visual LLM Cost Boundary | Page selection should not call DeepSeek unless the router explicitly chooses LLM generation | Open-ended selection text could previously upgrade deterministic Visual explanation into an LLM call | Fixed: Visual sync selections stay DOM/Postgres/RAG deterministic; explicit LLM explain requires `UseLLM=true`, `executionMode=llm_explain`, scoped citations, and external safety gates |
| Visual Privacy Boundary | RAG/LLM context must not leak employee or org-manager details to external providers | Selection labels and summaries could be reused in RAG query or LLM prompt | Fixed: employee/user labels are redacted to object-type hints for RAG; Visual LLM prompt skips employee, org-unit manager, Agent run, and audit-event details |
| AI Capability Boundary | AI surfaces must not bypass module RBAC | Chat SQL and Visual business refs could read objects using only AI feature capability | Fixed: per-intent chat capability checks and per-business-ref Visual capability checks |
| RAG Role Scope | Role-scoped knowledge must not leak across legal/entity or org boundaries | Role scopes with `scope_id IS NULL` could match any non-global user with the same role code | Fixed: non-global role RAG visibility now requires a concrete legal/entity or org scope match; covered by store unit test |
| Visual Action Boundary | LLM narrative must not change preview/human-review semantics | Successful DeepSeek explanation could overwrite a Visual action route as `llm_explain` | Fixed: Visual action intents preserve `action_preview` and human review even when LLM narration succeeds |
| API Contract | OpenAPI must remain the contract source for implemented routes | `/api/capabilities` existed in Go and web client but not in OpenAPI | Fixed: documented `/capabilities`, `Capability`, and `CapabilityListEnvelope`; follow-up adds attendance overview/analysis and RAG document detail |
| Agent Provider Boundary | Python agent must fail closed even if called directly | Go had stronger external-provider gates than Python agent direct endpoints | Fixed: DeepSeek chat requires scoped safe citations; remote embedding rejects PII/high-impact text; local embedding remains allowed |
| Agent Cost Boundary | Direct agent preview endpoints should not allow unbounded prompt/citation payloads | Citation snippets could be long enough to create high-cost DeepSeek calls | Fixed: `/chat/preview` rejects snippets over 2,000 chars and aggregate citation payloads over 9,000 chars before provider calls |
| Harness Isolation | Local checks should not pass against old services or wrong database ports | Infra `.env` production ports or empty local secrets could make harness hit an existing API, wrong Postgres, or fail Compose interpolation | Fixed: harness uses isolated `HARNESS_API_PORT`, refuses occupied ports, defaults local DB checks to `55432`, and supplies local-only defaults for required Compose interpolation |
| README Verification | Startup and harness docs must match real prerequisites | Native `DATABASE_URL` example could diverge from `infra/.env`; `npm run check` was described as all local harnesses | Fixed: native examples derive database URL from `infra/.env`; browser and embedding checks are documented as standalone with service prerequisites |

## Ruthless Review Round 1

- AI Command felt like chat plus trust badges: fixed by changing output to HR Scenario Workbench.
- Demo actions did not update audit: fixed by appending demo audit events from AI chat, RAG, agent run, tool preview, and Visual Copilot.
- Medium/high risk policy was inconsistent: fixed to low=view/explain, medium=preview plus review before write, high=blocked until explicit approval.
- Restricted knowledge was cited as normal evidence: fixed so high-risk demo answers use safe policy citation and mark restricted policy as review-only.
- Backend RAG previously allowed restricted citations: fixed so real lexical/vector retrieval returns only `normal` and `internal` sensitivity.
- Real `/api/ai/chat` previously lacked audit/high-risk gates: fixed with high-risk blocking and `ai.chat.*` audit events.
- Login and docs still had Co-Growth-first signals: fixed by making AI-HRMS the canonical entry and moving Co-Growth to module appendix.
- Demo company naming could be mistaken for a real enterprise case: mitigated by documenting `云衡互联网科技有限公司` as a fictional seeded demo company dataset, neutralizing direct real-company business-line echoes, and forbidding real-company/real-data framing in the 3-minute path.

## Final Review Checklist

- First screen states AI-HRMS positioning: passed.
- Demo path finishes in 3 minutes: passed.
- Co-Growth is a highlighted growth module, not the whole product: passed.
- High-risk HR suggestions are blocked or waiting for human review: passed.
- Citations, tool previews, and audit events are visible: passed.
- `VITE_DEMO_MODE=true` core path has no backend dependency: passed in browser review.
- Mobile route has navigation drawer: passed.
- `npm run web:check` and `npm run web:build`: passed.
- Real-mode checks: Go tests, Python agent harness, provider key scan, and TypeScript check passed after P2 integration.

## Ruthless Review Round 2

- Visual Copilot panel could cover the top of the viewport and the close action was not obvious: fixed with a pinned header, visible close button, `Esc` close, compact initial height, and scrollable result body.
- Visual Copilot explanation was too generic for DOM-only selections: fixed so the backend resolves nearby DOM modules, marks them as unverified client hints, and reserves trusted evidence for database-resolved business refs.
- `/app/audit` had horizontal overflow in browser review: fixed by constraining the audit table, wrapping long IDs/summaries, and hiding page-level overflow.
- RAG URL ingestion had SSRF risk: fixed with public-address validation, redirect validation, localhost/private/link-local/multicast rejection, and a dedicated timeout client.
- External embeddings could receive sensitive HR content: fixed with a gate that blocks internal/restricted documents, PII-like content, and high-impact HR decision text before sending to external embedding providers.
- Agent boundary token was optional even with real providers: fixed so API and Python agent require `AI_HRMS_AGENT_SERVICE_TOKEN` when chat or embedding providers are not `fake`.
- README opened with traditional HRMS positioning: fixed so the first paragraph states the Human-Agent Symbiotic HR Operating System positioning.
- Documentation overstated Visual Copilot image capability: fixed in the demo guide to state DOM + business-object context only; screenshots are not sent to DeepSeek.
- Documentation boundary pass aligned demo company note, key configuration, DeepSeek text-only Visual Copilot, RAG/pgvector wording, and 3-minute narration.
- Temporary Playwright spec and `test-results/` could be accidentally staged: fixed by moving the check into `harness/browser`, deleting temporary output, and ignoring Playwright artifacts.
- API harness still carried old `Average`/`simon` labels: fixed to use `陈向南`/`林晨` and current scoped-role expectations.
- Production deployment lacked first-admin bootstrap: fixed with password-stdin CLI and docs; the seed `123/password` account is now explicitly local demo only.

## Ruthless Review Round 3

- Product constraints and `AGENT.md` still framed the project as a `../saas_hrms` reproduction: fixed so future agents treat traditional HR screens as governed data-layer surfaces inside AI-HRMS.
- RAG document creation and ingestion could publish a no-scope document globally: fixed with fail-closed normalization, migration `010_rag_scope_fail_closed.sql`, and unit tests.
- Store-level chunk insertion could mix real and fallback embeddings when provider output was incomplete: fixed by rejecting partial or mixed provider/model/dimension batches before writing chunks.
- `/ai/chat` could drop retrieval-level `humanReviewRequired`: fixed by merging retrieval risk/HITL into the execution decision before LLM or deterministic response.
- Visual Copilot was tested too shallowly: fixed browser harness to perform a real region selection, submit an explanation, assert the text-only/no-image boundary, clear state, and close.
- Demo browser suite only detected backend calls after they happened: fixed by aborting backend/API routes in demo mode so accidental side effects become immediate test failures.
- Tablet navigation and mobile Copilot ergonomics were weak: fixed by aligning app-shell breakpoint with Ant Design `lg`, adding Copilot selection mode, and improving responsive Knowledge/Agent controls.
- Traditional pages still read like an admin backend: fixed page titles for users, employees, attendance, messages, org units, and legal entities to explain their role in scope, evidence, Agent preview, and audit.
- Legacy migration `006_sample_company_seed.sql` contains the sample-company seed data; runtime display names are corrected by append-only migration `012_demo_company_naming.sql`.
- Second-round backend review found embedding could run before final RAG scope normalization: fixed by normalizing in the handler before embedding, rejecting invalid scope fields, adding migration `011_rag_scope_constraint_tightening.sql`, and aligning OpenAPI rebuild status to `201`.
- Fourth-round Visual Copilot review found residual fixed-edge behavior: fixed by removing automatic panel edge snapping after selection, persisting layout preferences, enabling free X/Y rail movement, and adding safe capture reset for edge auto-scroll.
- Fourth-round RAG/LLM review found role-scope leakage risk: fixed by removing unscoped role document visibility for non-global principals and requiring scoped role documents to match resolved legal/entity or org IDs.
- Fourth-round RAG/LLM review found Visual action preview metadata could be softened by LLM success: fixed so action endpoints preserve preview/human-review semantics.
- Fourth-round delivery review found Python agent direct-call boundary was thinner than Go: fixed with agent-side DeepSeek citation safety and remote embedding text gates.
- Fourth-round delivery review found README startup/check ambiguity: fixed native database URL examples and clarified core versus standalone harnesses.
- Fourth-round browser review found the demo marker depended on responsive visible text: fixed with a stable `data-suite-mode` marker and reran desktop/mobile real+demo browser checks successfully.

## Scoring Snapshot

| Surface | Function | Visual | Copy | Demo Risk | Status |
| --- | ---: | ---: | ---: | --- | --- |
| Login | 5 | 5 | 5 | Low | Passed |
| Dashboard | 5 | 5 | 5 | Low | Passed |
| AI Command | 5 | 4 | 5 | Low | Passed |
| Knowledge | 5 | 4 | 5 | Medium | Real provider requires correct embedding dimensions |
| Co-Growth | 5 | 5 | 5 | Low | Passed |
| Agent Runs | 5 | 4 | 5 | Low | Passed |
| Audit | 5 | 4 | 5 | Low | Horizontal overflow fixed after browser review |
| Visual Copilot | 4 | 4 | 5 | Medium | No image understanding; DOM/business refs only |
| Help / Onboarding | 5 | 4 | 5 | Low | New user guide exists; admin guide hidden unless `group_admin` |
| Org Unit Operations | 5 | 4 | 4 | Low | Delete is reference-checked and audited; inactive remains safer for referenced units |
