# Database Harness

Validates PostgreSQL migrations and seed data.

Prerequisite:

```bash
docker compose -f infra/compose.yaml up -d postgres
until docker compose -f infra/compose.yaml exec -T postgres pg_isready -U ai_hrms -d ai_hrms; do sleep 1; done
```

Windows PowerShell:

```powershell
docker compose -f infra/compose.yaml up -d postgres
```

Run on Linux/WSL:

```bash
./harness/database/check.sh
```

Run on Windows PowerShell:

```powershell
.\harness\database\check.ps1
```

Current checks:

- Core tables exist.
- Seed data contains at least one current primary assignment.
- RAG embedding column uses configurable `vector` plus provider/model/dimension metadata.

The API service runs embedded migrations on startup. If this harness fails on a
fresh database, start the API once or add an explicit migration runner.
