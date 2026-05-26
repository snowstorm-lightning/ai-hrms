# Go Backend Constraints

## Architecture

Start as a modular Go monolith. Do not reproduce the source project's four Java microservices at the beginning.

Suggested modules:

```text
internal/auth
internal/legalentity
internal/orgunit
internal/user
internal/employee
internal/rbac
internal/audit
internal/agentbridge
```

## Responsibilities

- Go owns business authorization and data access.
- Python AI service does not directly access HRMS business tables.
- Cross-module writes that must be consistent should use one PostgreSQL transaction.

## Initial API Scope

- Health check.
- Auth login/profile.
- Legal entity listing.
- Organization unit listing.
- User listing.
- Employee listing with primary assignment.
