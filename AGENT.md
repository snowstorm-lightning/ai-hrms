# AI-HRMS AGENT Index

This file is an index for agents working on `ai-hrms`. Keep detailed constraints in the referenced documents, not in this file.

## Project Direction

- Product baseline: reproduce the useful business flows from `../saas_hrms`, then improve the implementation for a single-company HRMS with multiple subsidiaries.
- Frontend: TypeScript, React, Ant Design, modern versions.
- Backend: Go service, PostgreSQL database.
- AI: Python service managed by `uv`, used for AI agent and RAG-related work.
- Database: PostgreSQL first; plan for `pgvector`-backed RAG.
- Cache/queue: Redis is optional and should be introduced only when a concrete need appears.
- Organization model: legal entities, organization units, and employee assignments; first phase implements primary assignment while keeping schema support for multiple assignments.

## Constraint Index

| Area | Constraint Document | Status |
| --- | --- | --- |
| Product scope and migration target | `docs/constraints/product-scope.md` | active |
| Repository layout and module boundaries | `docs/constraints/repo-layout.md` | active |
| Frontend stack and UI standards | `docs/constraints/frontend.md` | active |
| Go backend architecture | `docs/constraints/backend-go.md` | active |
| PostgreSQL schema and migration rules | `docs/constraints/database-postgres.md` | active |
| Python AI service and `uv` workflow | `docs/constraints/python-ai.md` | active |
| RAG architecture and vector retrieval | `docs/constraints/rag.md` | active |
| AI-native product surfaces | `docs/constraints/ai-native.md` | active |
| Learning system | `docs/constraints/learning.md` | active |
| Agent autonomy and safety | `docs/constraints/agent-autonomy.md` | active |
| Visual Copilot interaction | `docs/constraints/visual-copilot.md` | active |
| Security, organization scoping, and RBAC | `docs/constraints/security-rbac.md` | active |
| API contract and compatibility policy | `docs/constraints/api-contract.md` | active |
| Testing and verification harness | `docs/constraints/testing-harness.md` | active |
| Documentation maintenance | `docs/constraints/documentation.md` | active |
| Code quality and review standards | `docs/constraints/code-quality.md` | active |
| CI, local development, and release gates | `docs/constraints/devops.md` | active |

## Harness Engineering Index

| Harness | Purpose | Location |
| --- | --- | --- |
| Project bootstrap harness | Verify required local tools | `harness/bootstrap/` |
| Migration harness | Validate PostgreSQL migrations and seed data | `harness/database/` |
| API harness | Smoke test contract-critical API flows | `harness/api/` |
| Frontend harness | Run type checks, build, and future UI smoke tests | `harness/frontend/` |
| Agent harness | Verify AI boundary and future evaluation checks | `harness/agent/` |
| E2E harness | Validate future core HRMS workflows across services | `harness/e2e/` |

## Decision Records

Architectural decisions are documented as ADRs under `docs/adr/`.

Accepted ADRs:

- `docs/adr/0001-use-postgresql.md`
- `docs/adr/0002-start-as-modular-go-monolith.md`
- `docs/adr/0003-keep-python-ai-service-separate.md`
- `docs/adr/0004-defer-redis-until-needed.md`
- `docs/adr/0005-use-openapi-as-api-contract.md`
- `docs/adr/0006-use-single-company-org-hierarchy.md`
- `docs/adr/0007-ai-native-architecture.md`
- `docs/adr/0008-agent-gateway-boundary.md`
- `docs/adr/0009-visual-copilot-layer.md`
- `docs/adr/0010-learning-rag-integration.md`

## Current Source Reference

- Source project: `../saas_hrms`
- Reusable areas and mapping rules are indexed in `docs/constraints/product-scope.md` and `docs/constraints/database-postgres.md`.
- API contract index: `packages/openapi/openapi.yaml`.

## Operating Notes

- Prefer reproducing behavior before expanding scope.
- Put durable rules in the constraint documents listed above.
- Put implementation decisions in ADRs.
- Put executable verification in harness folders.
- Keep this file and linked index documents maintained as the project changes.
- Keep `AGENT.md` under 80 lines; split details into referenced documents.
