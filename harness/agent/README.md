# Agent Harness

Validates AI agent and RAG behavior.

Run from the repo root on Linux/WSL:

```bash
./harness/agent/check.sh
```

Run from the repo root on Windows PowerShell:

```powershell
.\harness\agent\check.ps1
```

Current check:

- Tool authorization checks.
- Retrieval quality checks.
- Output schema checks.

The Python service must call Go-owned APIs or tools for HRMS data access.
