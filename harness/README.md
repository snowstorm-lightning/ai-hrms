# Harness Index

Harnesses are executable checks that make agent-driven work repeatable.
Each harness should state its prerequisites, command, and pass criteria.

| Harness | Purpose | Linux/WSL command | Windows command |
| --- | --- | --- | --- |
| `bootstrap` | Verify required local tools. | `./harness/bootstrap/check.sh` | `.\harness\bootstrap\check.ps1` |
| `database` | Verify PostgreSQL migrations and seed data. | `./harness/database/check.sh` | `.\harness\database\check.ps1` |
| `api` | Smoke test contract-critical API flows. | `./harness/api/check.sh` | `.\harness\api\check.ps1` |
| `frontend` | Run frontend type and build gates. | `./harness/frontend/check.sh` | `.\harness\frontend\check.ps1` |
| `browser` | Playwright smoke test for real/demo web routes and Visual Copilot. | `./harness/browser/check.sh` | `.\harness\browser\check.ps1` |
| `agent` | Verify Python agent boundary imports. | `./harness/agent/check.sh` | `.\harness\agent\check.ps1` |
| `e2e` | Validate cross-service HRMS workflows. | `./harness/e2e/check.sh` | `.\harness\e2e\check.ps1` |

Rules:

- Keep harnesses small enough to run locally.
- Prefer deterministic checks over manual inspection.
- Add or update a harness when a workflow becomes part of the product surface.
- Document external service assumptions in the harness README.

Run `npm run check` for the full local gate. On Linux/WSL this dispatches to
`harness/check.sh`; on Windows it dispatches to `harness/check.ps1`.

The top-level harness expects the Compose PostgreSQL service to be available,
runs migrations, starts a temporary Go API process, executes API and E2E smoke
checks, then stops only the process it started. Use the database and API
harnesses separately when you want to manage the API process yourself.

The browser harness is intentionally standalone because it expects real and demo
web servers to already be running. Use `npm run browser:check` after starting
the web servers.
