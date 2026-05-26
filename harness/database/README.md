# Database Harness

Validates PostgreSQL migrations and seed data.

Prerequisite:

```powershell
docker compose -f infra/compose.yaml up -d postgres
```

Run:

```powershell
.\harness\database\check.ps1
```

Current checks:

- Core tables exist.
- Seed data contains at least one current primary assignment.
- Verify constraints and primary workflow queries.

The API service runs embedded migrations on startup. If this harness fails on a
fresh database, start the API once or add an explicit migration runner.
