# Agent Harness

Validates AI agent and RAG behavior.

Run from the repo root:

```powershell
.\harness\agent\check.ps1
```

Current check:

- Import the Python app factory through `uv`.
- Confirm the service title remains `AI-HRMS Agent`.

Future checks:

- Tool authorization checks.
- Golden prompts for HRMS question answering.
- Retrieval quality checks.
- Output schema checks.

The Python service must call Go-owned APIs or tools for HRMS data access.
