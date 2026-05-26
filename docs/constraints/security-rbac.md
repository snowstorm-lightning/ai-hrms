# Security And RBAC Constraints

## Model

Use RBAC with scope bindings.

Scopes:

- `global`
- `legal_entity`
- `org_unit`

Scope bindings may include descendants.

## Initial Roles

- `group_admin`
- `group_hr`
- `entity_hr`
- `org_manager`
- `employee`

## Rules

- Backend authorization is authoritative.
- Frontend menu visibility is only a UX feature.
- HR users can be bound to multiple legal entities or organization units.
- Agent tool calls must use the caller's authorization scope.
- Capabilities decide which action may run; scope decides which data it may touch.
- AI, RAG, Visual Copilot, exports, and business writes must record audit events when they create risk or durable state.
