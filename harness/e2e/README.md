# E2E Harness

Validates core HRMS workflows across services.

Current workflow:

```text
login -> profile -> legal entities -> organization units -> users ->
employees -> attendance -> messages -> learning -> knowledge -> AI chat
```

Prerequisites are PostgreSQL and API running locally.

Run on Linux/WSL:

```bash
./harness/e2e/check.sh
```

Run on Windows PowerShell:

```powershell
.\harness\e2e\check.ps1
```

Use `API_BASE_URL` to target a non-default API URL.

Keep this harness focused on user-visible workflows. Lower-level authorization,
schema, and build checks belong in the database, API, and frontend harnesses.
