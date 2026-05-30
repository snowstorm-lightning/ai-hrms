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

Related checks:

- Browser smoke test for login, app shell, Visual Copilot, and Demo-mode backend isolation: `npm run browser:check`.

Planned checks:

- Visual checks for core pages after the UI stabilizes.
- Generated client drift check once OpenAPI generation is wired.
