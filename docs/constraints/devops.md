# DevOps Constraints

## Local Development

Use local infrastructure that can be started consistently from `infra`.
Linux/WSL is a first-class local development target; do not introduce a
Windows-only deployment or verification path.

Initial services:

- PostgreSQL.
- Optional Redis only when a concrete use case is introduced.

## CI Gates

Start with fast gates:

- Formatting.
- Type checks.
- Unit tests.
- API contract smoke tests.

CI gates should run the Linux/WSL harness entrypoints unless a job is explicitly
testing Windows behavior.

Add slower gates when workflows exist:

- Browser smoke tests.
- E2E tests.
- Agent evaluations.
