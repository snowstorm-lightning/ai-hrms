# PostgreSQL Constraints

## Database Direction

Use PostgreSQL as the system database. Plan for `pgvector` when RAG is introduced.

## Core Model

- `legal_entities`: independent legal entities such as the parent company and subsidiaries.
- `org_units`: departments, centers, branches, projects, or shared units.
- `employees`: person and HR profile data.
- `employee_assignments`: links employees to legal entities, organization units, positions, and assignment dates.

## Modeling Rules

- An organization unit may or may not belong to a legal entity.
- An employee may have multiple assignments.
- First-phase UI and API expose the primary assignment only.
- Keep schema support for multiple assignments from the start.
- Avoid SaaS tenant fields unless a future ADR reintroduces them.

## Source Mapping

- `co_company` maps to `legal_entities`.
- `co_department` maps to `org_units`.
- `em_user_employee` maps mostly to `employees`.
- Direct user company and department fields map to a primary `employee_assignments` row.
