# Database Harness

Validates PostgreSQL migrations and seed data.

Prerequisite:

```bash
docker compose --env-file infra/.env -f infra/compose.yaml -f infra/compose.dev.yaml up -d postgres
until docker compose --env-file infra/.env -f infra/compose.yaml -f infra/compose.dev.yaml exec -T postgres pg_isready -U ai_hrms -d ai_hrms; do sleep 1; done
```

Windows PowerShell:

```powershell
docker compose --env-file infra/.env -f infra/compose.yaml -f infra/compose.dev.yaml up -d postgres
do {
  Start-Sleep -Seconds 1
  docker compose --env-file infra/.env -f infra/compose.yaml -f infra/compose.dev.yaml exec -T postgres pg_isready -U ai_hrms -d ai_hrms
} until ($LASTEXITCODE -eq 0)
```

The dev compose override publishes PostgreSQL to `127.0.0.1:${POSTGRES_PORT:-55432}`.
The harness uses `HARNESS_DATABASE_URL` when set; otherwise it derives the URL
from `infra/.env` values `POSTGRES_PASSWORD` and `POSTGRES_PORT` so migration
and verification target the same database.

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
