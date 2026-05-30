# Browser Harness

Runs a Playwright smoke check against the AI-HRMS web experience.

Prerequisites:

- Local npm dependencies installed.
- A real-mode web dev or preview server, default `http://127.0.0.1:5173`.
- A demo-mode web dev or preview server, default `http://127.0.0.1:5174`.
- Playwright-managed Chromium installed. A system `chromium` binary is optional.

Install the Chromium browser cache when a fresh machine does not have it yet:

```bash
npm exec playwright install chromium
```

Run from the repo root on Linux/WSL:

```bash
./harness/browser/check.sh
```

Run from the repo root on Windows PowerShell:

```powershell
.\harness\browser\check.ps1
```

Equivalent npm shortcut:

```bash
npm run browser:check
```

Useful environment variables:

- `AI_HRMS_BROWSER_REAL_BASE_URL`: real-mode web URL, default `http://127.0.0.1:5173`.
- `AI_HRMS_BROWSER_DEMO_BASE_URL`: demo-mode web URL, default `http://127.0.0.1:5174`.
- `AI_HRMS_BROWSER_SKIP_REAL=true`: skip the real-mode suite.
- `AI_HRMS_BROWSER_SKIP_DEMO=true`: skip the demo-mode suite.
- `AI_HRMS_BROWSER_BACKEND_ORIGINS`: comma-separated backend origins treated as forbidden in demo mode, default `http://127.0.0.1:8080,http://localhost:8080`.
- `AI_HRMS_BROWSER_USERNAME` / `AI_HRMS_BROWSER_PASSWORD`: login credentials, default local seed account.
- `AI_HRMS_BROWSER_HEADFUL=true`: show the browser window while debugging.

Pass criteria:

- `/login`, `/app/dashboard`, `/app/ai-command`, `/app/knowledge`, `/co-growth`, `/app/learning`, `/app/agents`, and `/app/audit` render nonblank content.
- Page markers for the AI-HRMS product narrative are present.
- Visual Copilot opens and closes from both the app shell and `/co-growth`.
- No unfiltered console errors, page errors, request failures, or HTTP 4xx/5xx responses occur.
- Demo mode makes no backend requests to configured backend origins or `/api` paths.
