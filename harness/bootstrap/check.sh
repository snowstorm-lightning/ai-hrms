#!/usr/bin/env bash
set -euo pipefail

missing=()

require_tool() {
  local tool="$1"
  if ! command -v "$tool" >/dev/null 2>&1; then
    missing+=("$tool")
  fi
}

require_tool node
require_tool npm
require_tool go
require_tool uv
require_tool docker

if ! command -v python3 >/dev/null 2>&1 && ! command -v python >/dev/null 2>&1; then
  missing+=("python3 or python")
fi

if ! docker compose version >/dev/null 2>&1; then
  missing+=("docker compose")
fi

if ((${#missing[@]} > 0)); then
  printf 'Missing required tools: %s\n' "${missing[*]}"
  exit 1
fi

echo "Bootstrap check passed."
