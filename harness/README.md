# Harness Index

Harnesses are executable checks that make agent-driven work repeatable.
Each harness should state its prerequisites, command, and pass criteria.

| Harness | Purpose | Current command |
| --- | --- | --- |
| `bootstrap` | Verify required local tools. | `.\harness\bootstrap\check.ps1` |
| `database` | Verify PostgreSQL migrations and seed data. | `.\harness\database\check.ps1` |
| `api` | Smoke test contract-critical API flows. | `.\harness\api\check.ps1` |
| `frontend` | Run frontend type and build gates. | `.\harness\frontend\check.ps1` |
| `agent` | Verify Python agent boundary imports. | `.\harness\agent\check.ps1` |
| `e2e` | Reserve cross-service workflow checks. | Planned |

Rules:

- Keep harnesses small enough to run locally.
- Prefer deterministic checks over manual inspection.
- Add or update a harness when a workflow becomes part of the product surface.
- Document external service assumptions in the harness README.

Run `harness/check.ps1` for local checks that do not require a running API server. Use the database and API harnesses separately when the Compose database and Go API are running.
