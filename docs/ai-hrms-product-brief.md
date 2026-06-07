# AI-HRMS Product Brief

## Positioning

AI-HRMS｜人机共生的人力资源智能操作系统

AI-HRMS is not a traditional HRMS with a chat box attached. It is an operating system where people, organization data, governed knowledge, learning growth, agent runs, and audit evidence collaborate inside explicit safety boundaries.

Product/data boundary: AI-HRMS is the product. `企鹅互联网科技有限公司` is only a fictional demo company dataset with simulated business records used to show product workflows; it is not Tencent, is not affiliated with Tencent, and is not real company data.

## System Layers

- Organization Data Layer: employees, legal entities, org units, attendance, messages, roles, and scope.
- Knowledge & Learning Layer: governed RAG documents, citations, learning courses, and Co-Growth OS.
- Agent Collaboration Layer: AI Command Center, Agent Run Center, Visual Copilot, and workflow preview.
- Governance & Trust Layer: riskLevel, confidence, evidence, citation, humanReviewRequired, tool preview, auditStatus.
- Human-AI Co-evolution Layer: people define goals, AI proposes plans, agents preview actions, people confirm, and the system records evidence.

## Core Highlights

- AI-HRMS Command Dashboard: demo tour, global HR period/scope context,
  My Actions Required, system state, role value, and human-agent workflow.
- Large-page HRMS information architecture: the sidebar now exposes
  Dashboard, Org & People, Employee Ops, Recruitment & Lifecycle, Growth &
  Performance, Knowledge & Agent, Trust & Audit, and Settings as primary
  pages. Legacy routes remain accessible as child entries or compatibility
  paths.
- First-phase HRMS work-domain backend: leave applications, attendance
  requests, shift assignments, expense claims, salary slips, job
  requisitions/openings/applicants/interviews/offers, training events,
  performance goals, appraisal cycles, and appraisals are persisted in
  dedicated SQL tables and exposed through scoped Go APIs.
- Agentic HR Command Center: structured HR recommendations with citations, risk, confidence, tool preview, and audit preview.
- Governed Knowledge Hub: documents as scoped, trusted, sensitive knowledge sources for AI answers.
- Document Library Reader: catalog cards open dedicated document pages, with
  full body reading in the main pane and table-of-contents plus
  citation/governance metadata in drawers.
- Attendance Real-Time Cockpit: scoped attendance aggregation, exception
  drill-down with leave/attendance-request/shift context, and preview-only
  Agent analysis for HR follow-up.
- Co-Growth OS: the AI-HRMS growth engine for AI literacy, work missions, reflection, and evidence.
- Human-Agent Run Center: agent run cards with delegated context, tool preview, confirmation, and audit status.
- Trust, Audit & Evidence Layer: AI suggestions, citations, human review, blocked events, and reversible actions.

## Roles

- HR: sees organization trends, evidence-backed recommendations, and high-risk confirmation queues.
- Employee: sees learning missions, AI coach guidance, work journal, and growth evidence.
- Mentor: reviews reflections, confirms risky learning suggestions, and gives feedback.
- Manager: sees capability trends, agent runs, governance risk, and audit summaries.

## Demo Path

1. Login with demo mode and enter the AI-HRMS Command Dashboard.
2. Generate an HR recommendation in AI Command Center.
3. Inspect citations and knowledge governance in Knowledge Hub.
4. Open a document detail page from the Document Library and show the
   left/right drawers for contents and governance status.
5. Show Attendance Real-Time Cockpit metrics, exception drill-down, and Agent
   analysis preview.
6. Enter Co-Growth OS to show learning missions and reflection evidence.
7. Create or inspect an Agent run with tool preview and human confirmation.
8. Open Audit Center to show the evidence chain.
9. Close with the human-agent governance loop.

Narration rule: keep the 3-minute walkthrough about AI-HRMS capabilities. Treat company dataset names, employees, policies, and citations as sample data, not as a real enterprise case study.

## Safety Boundaries

- AI does not make final promotion, termination, pay, performance, or hiring decisions.
- High-risk suggestions are preview-only until a human confirms them.
- Recruitment, performance, salary, and attendance exception records can be
  created and updated as auditable work items, but first-phase business rules
  intentionally stop at CRUD/status workflow and human review boundaries.
- Demo mode uses deterministic local data and does not call external LLMs.
- Demo company data is fictional and must not be presented as Tencent or any real company's HR data.
- Production reads, writes, RAG retrieval, tool calls, and audit events go through Go authorization and scope checks.
- DeepSeek chat and OpenAI-compatible embeddings run behind the Python agent boundary; chat and embedding providers are configured independently, and provider keys do not belong in frontend code.
- Visual Copilot is text/context only in the current DeepSeek boundary: DOM hints and verified business references can support explanations, but screenshots are not sent to DeepSeek and image understanding is out of scope.
- Attendance Agent analysis is a read-only, preview-first path; it can produce
  scoped aggregate insights and follow-up suggestions, but not disciplinary,
  performance, pay, or termination decisions.
- Agent harness policy is explicit: deterministic program flows handle permissions, scope, retrieval, tool execution, and audit; LLMs are used for explanation and drafting; bounded agents are reserved for cross-module multi-step work.

See [agent-harness-engineering.md](agent-harness-engineering.md) for the routing policy and trust packet model.

## P0

- Dashboard, Login, AI Command, Knowledge, Document Library, Attendance,
  Co-Growth, Agent Runs, Audit, docs, demo mode, build/check.
- No backend dependency for the core demo when `VITE_DEMO_MODE=true`.
- Every AI-facing page shows trust metadata and human-in-the-loop boundaries.

## P1

- Persona switch, scenario gallery, collaboration rubric, Visual Copilot showcase, mentor queue, richer work journal.

## P2

- Completed provider plumbing: DeepSeek OpenAI-compatible chat adapter through the Python agent boundary.
- Completed vector RAG foundation: PostgreSQL/pgvector configurable embeddings with scope/sensitivity filters, vector-first retrieval, and explicit lexical fallback.
- Completed LangGraph workflow demo: Python graph models risk classification, scoped context, tool preview, human review, and audit status.
- Completed chart enhancement: Dashboard uses `@ant-design/charts` for operating signals.
- Completed deployment hardening: `.env` ignored, example files scrubbed, Compose sends provider secrets only to the agent service.
