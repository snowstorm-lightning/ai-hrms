# Bootstrap Harness

Verifies that required local tools are available.

Required tools:

- Node.js and npm.
- Go 1.26 or newer.
- Python 3.12 or newer, available as `python3` or `python`.
- `uv`.
- Docker with Docker Compose v2.

Run on Linux/WSL:

```bash
./harness/bootstrap/check.sh
```

Run on Windows PowerShell:

```powershell
.\harness\bootstrap\check.ps1
```

Pass criteria:

- Every required executable is discoverable from the current shell.
- The check does not install or mutate dependencies.

Update this harness when the required local toolchain changes.
