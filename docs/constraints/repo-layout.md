# Repository Layout Constraints

## Target Layout

```text
apps/
  web/
  api/
  agent/
docs/
  adr/
  constraints/
harness/
  bootstrap/
  database/
  api/
  frontend/
  agent/
  e2e/
infra/
```

## Boundaries

- `apps/web`: React, TypeScript, Ant Design frontend.
- `apps/api`: Go backend and business authorization.
- `apps/agent`: Python AI service managed by `uv`.
- `infra`: local and deployment infrastructure.
- `harness`: executable verification and smoke checks.
- `docs/constraints`: durable implementation constraints.
- `docs/adr`: architectural decisions.

## Rule

Do not put durable architectural decisions only in code comments or chat history. Record them in ADRs or constraint documents.
