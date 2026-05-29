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
| P2 Real AI/RAG | DeepSeek-compatible provider plumbing and pgvector RAG foundation are deployable without leaking keys | Provider config existed but no real boundary or vector retrieval | Fixed: Python agent provider adapters, Go agentbridge, pgvector configurable embeddings, `.env` ignored |
| P2 Workflow/Charts | LangGraph demo and charting are real code paths, not static claims | Optional P2 items could look unfinished | Fixed: Python LangGraph workflow endpoint and Dashboard `@ant-design/charts` operating signals |

## Ruthless Review Round 1

- AI Command felt like chat plus trust badges: fixed by changing output to HR Scenario Workbench.
- Demo actions did not update audit: fixed by appending demo audit events from AI chat, RAG, agent run, tool preview, and Visual Copilot.
- Medium/high risk policy was inconsistent: fixed to low=view/explain, medium=preview plus review before write, high=blocked until explicit approval.
- Restricted knowledge was cited as normal evidence: fixed so high-risk demo answers use safe policy citation and mark restricted policy as review-only.
- Backend RAG previously allowed restricted citations: fixed so real lexical/vector retrieval returns only `normal` and `internal` sensitivity.
- Real `/api/ai/chat` previously lacked audit/high-risk gates: fixed with high-risk blocking and `ai.chat.*` audit events.
- Login and docs still had Co-Growth-first signals: fixed by making AI-HRMS the canonical entry and moving Co-Growth to module appendix.

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
