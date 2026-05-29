# AI-HRMS Demo Guide

## Project

AI-HRMS｜人机共生的人力资源智能操作系统

This assignment submission presents the full AI-HRMS product. Co-Growth OS is one strong module inside AI-HRMS: the growth engine for AI literacy, work missions, reflection, and evidence.

## Demo Mode

Use deterministic frontend demo data:

```bash
VITE_DEMO_MODE=true npm run web:dev
```

Open:

```text
http://127.0.0.1:5173/login
```

The demo login button enters the AI-HRMS dashboard. Direct links such as `/app/dashboard` and `/co-growth` are supported after demo login.

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
AI_CHAT_PROVIDER=deepseek
DEEPSEEK_API_KEY=<local-secret>
AI_EMBEDDING_PROVIDER=openai-compatible
OPENAI_COMPATIBLE_EMBEDDING_API_KEY=<local-secret>
OPENAI_COMPATIBLE_EMBEDDING_BASE_URL=<embedding-base-url>
OPENAI_COMPATIBLE_EMBEDDING_MODEL=<embedding-model>
RAG_EMBEDDING_DIMENSIONS=<embedding-dimensions>
```

The Go API keeps RBAC, scope filtering, audit logging, and high-risk gates. The Python agent receives scoped text only and calls DeepSeek/OpenAI-compatible providers. RAG vectors are stored in PostgreSQL/pgvector.

P2 extras are included as code paths: `/api/agent/workflows/langgraph/demo` proxies a Python LangGraph workflow demo through Go, and the Dashboard uses `@ant-design/charts` for operating signals.

## Recommended Path

1. `/login`: enter AI-HRMS demo.
2. `/app/dashboard`: explain the operating-system positioning and demo tour.
3. `/app/ai-command`: generate a governed HR recommendation.
4. `/app/knowledge`: inspect citations, trust level, sensitivity, and scope.
5. `/co-growth`: show human-AI co-growth missions and evidence.
6. `/app/agents`: show agent run control, tool preview, and human confirmation.
7. `/app/audit`: show the trust and evidence layer.

## Core Highlights

- Command Dashboard
- Agentic HR Command Center
- Governed Knowledge Hub
- Co-Growth OS
- Human-Agent Run Center
- Trust, Audit & Evidence Layer
- Visual Copilot Showcase

## Reviewer Notes

- Demo AI outputs are deterministic mock responses for public demo stability and privacy.
- Real mode has provider adapters for DeepSeek chat plus OpenAI-compatible embeddings through the Python agent boundary.
- High-risk HR scenarios are preview-only and require human review.
- The demo does not automate promotion, termination, pay, performance, or hiring decisions.
- Production architecture keeps Go responsible for authorization, scope, execution, and audit.

## Known Boundaries

- Public assignment demo is optimized for `VITE_DEMO_MODE=true`.
- Real mode requires configured provider keys and a compatible embedding model/dimension.
- Visual Copilot is demonstrated as a governed selection and preview layer.
