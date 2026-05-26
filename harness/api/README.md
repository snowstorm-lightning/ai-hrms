# API Harness

Validates the OpenAPI contract and endpoint smoke tests.

Prerequisites:

- PostgreSQL is running.
- API is running at `API_BASE_URL`, or `http://localhost:8080/api` by default.
- Seed account `123` / `password` exists.

Run on Linux/WSL:

```bash
./harness/api/check.sh
```

With a custom API URL:

```bash
API_BASE_URL=http://localhost:8080/api ./harness/api/check.sh
```

Run on Windows PowerShell:

```powershell
.\harness\api\check.ps1
```

Current smoke flow:

```text
health -> login -> profile -> legal entities -> org units -> users ->
roles -> role bindings -> employees -> employee CSV -> attendance ->
attendance CSV -> messages -> RAG -> AI chat -> agent tools -> Visual Copilot
```

Contract reference:

- `packages/openapi/openapi.yaml`

The harness includes scoped-account rejection checks for legal-entity,
employee, attendance, roles, and user visibility. Future work should broaden
CRUD coverage without weakening these scope checks.
