# AI-HRMS Review Matrix

| Surface | Review Standard | Round 1 Finding | Fix Status |
| --- | --- | --- | --- |
| Login | 10 seconds to understand AI-HRMS and enter demo | Co-Growth direct CTA could confuse the submission subject | Fixed: AI-HRMS is the only primary demo entry |
| Dashboard | Modern AI SaaS command entry, demo tour, role value | Needed to stop looking like org-count admin | Fixed: Command Dashboard, tour, workflow, roles, trust snapshot |
| AI Command | Scenario workbench with evidence, risk, tool preview, audit | Too close to chat answer plus decorations | Fixed: HR Scenario Workbench, decision gate, unified risk policy |
| Knowledge | Governed RAG hub with trust, sensitivity, scope, citation preview | Restricted docs could appear as normal citations | Fixed: high-risk query uses safe citation and marks restricted policy as review-only |
| Co-Growth | AI-HRMS growth engine, not whole product | Strong module could dominate narrative | Fixed: title and docs position it as growth engine |
| Agent Runs | Run cards, delegated context, tool preview, confirmation, audit | Static run log risk | Fixed: cards, tool preview, human confirmation and dynamic audit events |
| Audit | Evidence chain, blocked high-risk items, human review | Static audit rows weakened trust loop | Fixed: demo actions append audit events |
| Learning | Learning as AI-HRMS layer and Co-Growth entry | Mostly LMS table | Fixed: positioning updated; Co-Growth entry remains as module path |
| Demo Mode | No backend dependency on core path; no console errors | Partial mock risk | Fixed for core and common side paths; browser pass shows 0 `/api` requests |
| Docs | AI-HRMS is submission subject | Co-Growth-first docs remained | Fixed: assignment, script, README, demo guide, module appendix |
| Demo Company Boundary | AI-HRMS is product; demo company dataset is fictional data | Company naming could be confused with real enterprise data | Mitigated: docs state `企鹅互联网科技有限公司` is simulated company data, not Tencent or real HR data; seeded business lines use neutral fictional names |
| P2 Real AI/RAG | DeepSeek-compatible provider plumbing and pgvector RAG foundation are deployable without leaking keys | Provider config existed but no real boundary or vector retrieval | Fixed: Python agent provider adapters, Go agentbridge, pgvector configurable embeddings, `.env` ignored |
| P2 Workflow/Charts | LangGraph demo and charting are real code paths, not static claims | Optional P2 items could look unfinished | Fixed: Python LangGraph workflow endpoint and Dashboard `@ant-design/charts` operating signals |
| Browser Harness | Playwright/Chromium status and route smoke checks are reproducible | Browser review was manual and temporary artifacts could leak | Fixed: `harness/browser` verifies package/cache/system Chromium status, route smoke, Visual Copilot, and demo backend isolation |
| Migration Integrity | Published migrations are immutable; new demo data is append-only | `002/004` had been rewritten for Penguin data and could checksum-fail old databases | Fixed: restored `002/004`, locked checksums in tests, kept Penguin data in `006`, and added narrow repair for known pre-release seed checksums |
| Production Bootstrap | Production with demo seed disabled still has a first-admin path | `AI_HRMS_ENABLE_DEMO_SEED=false` left no login user | Fixed: `ai-hrms-admin bootstrap-admin` one-shot CLI, Docker Compose bootstrap profile, and system roles migration |

## Ruthless Review Round 1

- AI Command felt like chat plus trust badges: fixed by changing output to HR Scenario Workbench.
- Demo actions did not update audit: fixed by appending demo audit events from AI chat, RAG, agent run, tool preview, and Visual Copilot.
- Medium/high risk policy was inconsistent: fixed to low=view/explain, medium=preview plus review before write, high=blocked until explicit approval.
- Restricted knowledge was cited as normal evidence: fixed so high-risk demo answers use safe policy citation and mark restricted policy as review-only.
- Backend RAG previously allowed restricted citations: fixed so real lexical/vector retrieval returns only `normal` and `internal` sensitivity.
- Real `/api/ai/chat` previously lacked audit/high-risk gates: fixed with high-risk blocking and `ai.chat.*` audit events.
- Login and docs still had Co-Growth-first signals: fixed by making AI-HRMS the canonical entry and moving Co-Growth to module appendix.
- Demo company naming could be mistaken for a real enterprise case: mitigated by documenting `企鹅互联网科技有限公司` as a fictional seeded demo company dataset, neutralizing direct real-company business-line echoes, and forbidding Tencent/real-data framing in the 3-minute path.

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
