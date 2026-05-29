# Co-Growth OS Module Appendix

Co-Growth OS is not the whole assignment submission. It is the AI-HRMS growth
engine: a module for AI literacy, work-embedded learning missions, reflection,
AI Work Journal, and growth evidence.

For the full submission demo, use `docs/ai-hrms-demo.md` and start from
`/login` → `/app/dashboard`.

## Direct Module Link

After demo login, open:

```text
http://127.0.0.1:5173/co-growth
```

## Demo Mode

```bash
VITE_DEMO_MODE=true npm run web:dev
```

Co-Growth uses deterministic local data in demo mode. It does not call external
LLMs and does not use learning signals for promotion, pay, performance, hiring,
or termination decisions.

## Module Boundary

- AI Coach generates learning suggestions and mission previews.
- High-risk scenarios show `humanReviewRequired=true`.
- Mission status is persisted in localStorage for demo continuity.
- Team heatmap is an aggregate learning signal, not an individual ranking.
