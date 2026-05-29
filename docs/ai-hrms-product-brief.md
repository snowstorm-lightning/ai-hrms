# AI-HRMS Product Brief

## Positioning

AI-HRMS｜人机共生的人力资源智能操作系统

AI-HRMS is not a traditional HRMS with a chat box attached. It is an operating system where people, organization data, governed knowledge, learning growth, agent runs, and audit evidence collaborate inside explicit safety boundaries.

## System Layers

- Organization Data Layer: employees, legal entities, org units, attendance, messages, roles, and scope.
- Knowledge & Learning Layer: governed RAG documents, citations, learning courses, and Co-Growth OS.
- Agent Collaboration Layer: AI Command Center, Agent Run Center, Visual Copilot, and workflow preview.
- Governance & Trust Layer: riskLevel, confidence, evidence, citation, humanReviewRequired, tool preview, auditStatus.
- Human-AI Co-evolution Layer: people define goals, AI proposes plans, agents preview actions, people confirm, and the system records evidence.

## Core Highlights

- AI-HRMS Command Dashboard: demo tour, system state, role value, and human-agent workflow.
- Agentic HR Command Center: structured HR recommendations with citations, risk, confidence, tool preview, and audit preview.
- Governed Knowledge Hub: documents as scoped, trusted, sensitive knowledge sources for AI answers.
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
4. Enter Co-Growth OS to show learning missions and reflection evidence.
5. Create or inspect an Agent run with tool preview and human confirmation.
6. Open Audit Center to show the evidence chain.
7. Close with the human-agent governance loop.

## Safety Boundaries

- AI does not make final promotion, termination, pay, performance, or hiring decisions.
- High-risk suggestions are preview-only until a human confirms them.
- Demo mode uses deterministic local data and does not call external LLMs.
- Production reads, writes, RAG retrieval, tool calls, and audit events go through Go authorization and scope checks.
- DeepSeek chat and OpenAI-compatible embeddings run behind the Python agent boundary; provider keys do not belong in frontend code.

## P0

- Dashboard, Login, AI Command, Knowledge, Co-Growth, Agent Runs, Audit, docs, demo mode, build/check.
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
