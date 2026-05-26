# Frontend Harness

Validates frontend quality gates.

Run from the repo root on Linux/WSL:

```bash
./harness/frontend/check.sh
```

Run from the repo root on Windows PowerShell:

```powershell
.\harness\frontend\check.ps1
```

Current checks:

- Type check.
- Build.

Planned checks:

- Browser smoke test for login and app shell.
- Visual checks for core pages after the UI stabilizes.
- Generated client drift check once OpenAPI generation is wired.
