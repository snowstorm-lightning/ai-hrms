#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

(
  cd "$ROOT"
  npm run web:check
  npm run web:build
)

echo "Frontend check passed."
