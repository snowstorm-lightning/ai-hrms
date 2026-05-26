# API Harness

Validates the OpenAPI contract and endpoint smoke tests.

Prerequisites:

- PostgreSQL is running.
- API is running at `API_BASE_URL`, or `http://localhost:8080/api` by default.
- Seed account `123` / `password` exists.

Run:

```powershell
.\harness\api\check.ps1
```

Current smoke flow:

```text
health -> login -> profile -> legal entities -> org units -> users ->
roles -> role bindings -> employees -> employee CSV -> attendance ->
attendance CSV -> messages
```

Contract reference:

- `packages/openapi/openapi.yaml`

The harness includes scoped-account rejection checks for legal-entity,
employee, attendance, roles, and user visibility. Future work should broaden
CRUD coverage without weakening these scope checks.
