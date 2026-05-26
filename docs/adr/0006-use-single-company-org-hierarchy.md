# ADR 0006: Use Single-Company Organization Hierarchy

## Status

Accepted

## Context

AI-HRMS is not a SaaS multi-tenant HRMS. It serves one corporate group that can contain multiple subsidiaries with independent legal entity attributes. Departments do not always belong to a subsidiary. Employees can have multiple assignments. HR users may manage multiple specified subsidiaries or organization units.

## Decision

Use legal entities, organization units, and employee assignments as the core organization model.

First-phase product surfaces primary assignment only, while the database supports multiple assignments.

## Consequences

- Do not reproduce tenant isolation from the source project.
- Replace old company-department assumptions with organization scoping.
- RBAC uses scoped role bindings rather than tenant-level roles.
- RAG and AI tools must respect organization scopes.
