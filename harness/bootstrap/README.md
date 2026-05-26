# Bootstrap Harness

Verifies that required local tools are available.

Required tools:

- Node.js and npm or pnpm.
- Go.
- Python.
- `uv`.
- Docker.

Run:

```powershell
.\harness\bootstrap\check.ps1
```

Pass criteria:

- Every required executable is discoverable from the current shell.
- The check does not install or mutate dependencies.

Update this harness when the required local toolchain changes.
