# Browser Harness

Runs a Playwright smoke check against the AI-HRMS web experience.

Prerequisites:

- Local npm dependencies installed.
- A real-mode web dev or preview server, default `http://127.0.0.1:5173`.
- A demo-mode web dev or preview server, default `http://127.0.0.1:5174`.
- For the real-mode suite, a Go API server with the local seed account must be
  reachable at the web app's configured API URL, typically native
  `http://127.0.0.1:8080/api` or Docker `http://127.0.0.1:8020/api`, unless
  `AI_HRMS_BROWSER_SKIP_REAL=true`.
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

## Local Servers

Start both local web servers when you want to run the full real/demo check:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8080/api npm run web:dev:real
npm run web:dev:demo
```

Use separate terminals. Both scripts use `--strictPort` so a stale server is
visible instead of silently moving to a different port.

If the real API is the Docker API, start real web with
`VITE_API_BASE_URL=http://127.0.0.1:8020/api npm run web:dev:real` instead.

Useful environment variables:

- `AI_HRMS_BROWSER_REAL_BASE_URL`: real-mode web URL, default `http://127.0.0.1:5173`.
- `AI_HRMS_BROWSER_DEMO_BASE_URL`: demo-mode web URL, default `http://127.0.0.1:5174`.
- `AI_HRMS_BROWSER_SKIP_REAL=true`: skip the real-mode suite.
- `AI_HRMS_BROWSER_SKIP_DEMO=true`: skip the demo-mode suite.
- `AI_HRMS_BROWSER_BACKEND_ORIGINS`: comma-separated backend origins treated as forbidden in demo mode, default `http://127.0.0.1:8080,http://localhost:8080,http://127.0.0.1:8020,http://localhost:8020`.
- `AI_HRMS_BROWSER_USERNAME` / `AI_HRMS_BROWSER_PASSWORD`: login credentials, default local seed account.
- `AI_HRMS_BROWSER_HEADFUL=true`: show the browser window while debugging.

Pass criteria:

- `/login`, `/app/dashboard`, `/app/ai-command`, `/app/knowledge`,
  `/app/docs`, `/app/docs/rag-doc-002`, `/app/attendance`, `/co-growth`,
  `/app/learning`, `/app/agents`, and `/app/audit` render nonblank content.
- Page markers for the AI-HRMS product narrative are present.
- Visual Copilot opens without the old side-switch control, supports panel drag
  and resize, performs one governed DOM/business-context selection, reports the
  no-image-analysis boundary, shows a direct answer before expandable details,
  clears the selection, and closes from both the app shell and `/co-growth`.
- In real mode, the Visual Copilot submit payload must include the exact
  selected `data-vc-object-type` / `data-vc-object-id`; a generic
  `business_ref>0` count is not enough.
- Visual Copilot can collapse into a narrow icon rail; the rail can be moved,
  and collapsed mode does not block modal form input.
- Visual Copilot requests stay JSON-only and must not include screenshots,
  base64 image payloads, image content types, or multipart uploads.
- No unfiltered console errors, page errors, request failures, or HTTP 4xx/5xx responses occur.
- Demo mode makes no backend requests to configured backend origins or `/api` paths.
