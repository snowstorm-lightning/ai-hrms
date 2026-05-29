# API Contract Constraints

## Contract Source

Use `packages/openapi/openapi.yaml` as the API contract source for frontend-backend integration.

## Rules

- Prefer generated TypeScript clients over manually assembled endpoint strings.
- Keep response envelopes consistent.
- Include pagination shapes in the contract.
- Treat breaking contract changes as explicit decisions.
- Keep authorization expectations visible on protected operations.
- Use the OpenAPI file as an index for main flows even before it is exhaustive.

## Current Contract Surface

- Health.
- Auth login/profile.
- Legal entities.
- Organization units.
- Roles and user role bindings.
- Users.
- Employees.
- Attendance.
- Employee and attendance CSV export.
- Messages and comments.
- RAG sources, documents, ingest jobs, vector search, AI chat, and sanitized provider status.

## Response Shape

All Go API responses use an envelope with:

- `success`.
- `code`.
- `message`.
- `data` when a response body exists.

Paged lists use `data.total` and `data.rows`.
