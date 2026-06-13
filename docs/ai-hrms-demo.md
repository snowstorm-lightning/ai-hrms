# AI-HRMS Demo Guide

## Project

AI-HRMS｜人机共生的人力资源智能操作系统

This assignment submission presents the full AI-HRMS product. Co-Growth OS is one strong module inside AI-HRMS: the growth engine for AI literacy, work missions, reflection, and evidence.

Demo company note: AI-HRMS is the product being demonstrated. `云衡互联网科技有限公司` is a fictional seeded demo company dataset and business dataset only; it is not affiliated with any real company and does not represent real company data.

## Demo Mode

Use deterministic frontend demo data:

```bash
npm run web:dev:demo
```

Open:

```text
http://127.0.0.1:5174/login
```

The demo login button enters the AI-HRMS dashboard. Direct links such as `/app/dashboard` and `/co-growth` are supported after demo login.

All company names, employees, policies, citations, audit events, and HR scenarios in demo mode are simulated data for the AI-HRMS product walkthrough.

Real-mode seeded local login, only when `AI_HRMS_ENABLE_DEMO_SEED=true`:

```text
mobile: 123
password: password

mobile: demo
password: password
```

When `AI_HRMS_ENABLE_DEMO_SEED=false`, create the first production admin with
the `bootstrap-admin` one-shot service described in `README.md`; the seed login
above will not exist.

## Build

```bash
VITE_DEMO_MODE=true npm run web:build
```

The static frontend can be deployed behind Nginx. In demo mode, the core review path does not require Go, PostgreSQL, Python, external LLMs, or external network calls.

Static hosting note: deploy `apps/web/dist` after `VITE_DEMO_MODE=true npm run web:build` and configure SPA fallback so unknown routes serve `index.html`.

## Real AI / RAG Mode

For deployable mode, start PostgreSQL, the Go API, the Python agent boundary, and the web app. Configure DeepSeek only on the agent process:

```bash
AGENT_BASE_URL=http://127.0.0.1:8090
AI_HRMS_AGENT_SERVICE_TOKEN=<openssl-rand-hex-32>
AI_CHAT_PROVIDER=deepseek
DEEPSEEK_API_KEY=<local-secret>
AI_EMBEDDING_PROVIDER=local-openai-compatible
OPENAI_COMPATIBLE_EMBEDDING_API_KEY=local-no-auth
OPENAI_COMPATIBLE_EMBEDDING_BASE_URL=http://127.0.0.1:8082/v1
OPENAI_COMPATIBLE_EMBEDDING_MODEL=Qwen3-Embedding-0.6B-Q8_0
RAG_EMBEDDING_DIMENSIONS=1024
```

The Go API keeps RBAC, scope filtering, audit logging, and high-risk gates. The Python agent receives scoped text only and calls DeepSeek for chat plus an independent OpenAI-compatible embedding endpoint for RAG vectors. RAG vectors are stored in PostgreSQL/pgvector.

Security defaults:

- `AI_HRMS_AGENT_SERVICE_TOKEN` is required whenever chat or embedding providers are not `fake`; generate it with `openssl rand -hex 32` and use the same value for API and agent.
- The demo `RAG_EMBEDDING_DIMENSIONS=8` is only for fake embeddings. Real providers must use the actual embedding model dimension before ingesting documents.
- External embeddings are blocked for internal/restricted documents or text that appears to contain personal or high-impact HR data.
- URL ingestion rejects localhost, private, link-local, multicast, and redirect targets that resolve to non-public addresses.

P2 extras are included as code paths: `/api/agent/workflows/langgraph/demo` proxies a Python LangGraph workflow demo through Go, and the Dashboard uses `@ant-design/charts` for operating signals.

## Recommended Path

1. `/login`: enter AI-HRMS demo.
2. `/app/dashboard`: explain the operating-system positioning and demo tour.
3. `/app/ai-command`: generate a governed HR recommendation.
4. `/app/knowledge`: inspect citations, trust level, sensitivity, and scope.
5. `/app/docs`: open a document detail page. The catalog stays lightweight;
   full reading happens on a dedicated page, with the local table of contents in
   a left drawer and citation/governance status in a right drawer.
6. `/app/attendance`: show the real-time attendance cockpit, exception
   drill-down, and preview-only Agent analysis with human review required.
7. `/co-growth`: show human-AI co-growth missions and evidence.
8. `/app/agents`: show agent run control, tool preview, and human confirmation.
9. `/app/audit`: show the trust and evidence layer.
10. `/app/help`: show the product guide, Visual Copilot usage, and admin-only operating notes.

For a 3-minute review, introduce `云衡互联网科技有限公司` only as the sample company dataset so the audience does not read the walkthrough as any real company's HR data.

## Core Highlights

- Command Dashboard
- Agentic HR Command Center
- Governed Knowledge Hub
- Document Library detail reader
- Attendance real-time cockpit
- Co-Growth OS
- Human-Agent Run Center
- Trust, Audit & Evidence Layer
- Visual Copilot Showcase

## Reviewer Notes

- Demo AI outputs are deterministic mock responses for public demo stability and privacy.
- Demo company data is fictional company data for AI-HRMS; it is not real HR data.
- Real mode has provider adapters for DeepSeek chat plus OpenAI-compatible embeddings through the Python agent boundary.
- High-risk HR scenarios are preview-only and require human review.
- The demo does not automate promotion, termination, pay, performance, or hiring decisions.
- Production architecture keeps Go responsible for authorization, scope, execution, and audit.
- Visual Copilot does not perform image understanding in the DeepSeek text-provider setup. It explains selections through DOM hints, verified business object references, route context, scope checks, and audit records. Screenshots are not sent to DeepSeek; pixel-level image explanation requires a future vision-capable OpenAI-compatible provider.
- Attendance Agent analysis is preview-only: it uses scoped attendance aggregates
  and a read-only `attendance_realtime_overview` tool preview, then requires HR
  or manager review before any follow-up.
- RAG document details are a reading surface, not a bypass around retrieval:
  formal answers still need scoped RAG search, citations, trust metadata, and
  audit status.

## Known Boundaries

- Public assignment demo is optimized for `VITE_DEMO_MODE=true`.
- Real mode requires configured provider keys and a compatible embedding model/dimension.
- Visual Copilot is demonstrated as a governed selection and preview layer, not as a screenshot OCR or image-understanding model.
