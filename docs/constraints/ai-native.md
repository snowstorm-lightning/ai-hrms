# AI-Native Constraints

## Direction

AI features are product surfaces, not a separate chat-only appendix.

Use natural language, visual annotation, forms, tables, and task flows together.

## Product Rules

- Every AI answer that depends on knowledge must expose citations.
- Every executable AI suggestion must expose confidence, risk, and preview.
- Write actions must be auditable and reversible or compensatable.
- People-impacting conclusions remain recommendations with evidence.

## Boundaries

Frontend calls Go only. Go owns authorization, scope, audit, and execution.

Python providers and agents receive delegated context from Go and do not own HRMS data permissions.
