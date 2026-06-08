#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${AI_HRMS_ENV_FILE:-$ROOT/infra/.env}"
COMPOSE_FILE="${AI_HRMS_COMPOSE_FILE:-$ROOT/infra/compose.prod.yaml}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE"
  echo "Create it from infra/.env.example and fill production values first."
  exit 1
fi

env_file_value() {
  local key="$1"
  local line value
  line="$(grep -E "^[[:space:]]*$key[[:space:]]*=" "$ENV_FILE" | tail -n 1 || true)"
  value="${line#*=}"
  value="${value%%#*}"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  printf '%s' "$value"
}

ENABLE_EMBEDDING="${AI_HRMS_ENABLE_EMBEDDING:-}"
if [[ -z "$ENABLE_EMBEDDING" ]]; then
  ENABLE_EMBEDDING="$(env_file_value AI_HRMS_ENABLE_EMBEDDING)"
fi
ENABLE_EMBEDDING="${ENABLE_EMBEDDING:-false}"

compose=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
runtime_services=(postgres)
stack_services=(postgres agent api web)

case "${ENABLE_EMBEDDING,,}" in
  1|true|yes|on)
    compose+=(--profile embedding)
    runtime_services+=(embedding)
    stack_services=(postgres embedding agent api web)
    ;;
esac

echo "Validating production compose config..."
"${compose[@]}" config >/dev/null

echo "Ensuring runtime images are available..."
"${compose[@]}" pull --policy missing "${runtime_services[@]}"

echo "Pulling application images..."
"${compose[@]}" pull api web agent

echo "Starting production stack..."
"${compose[@]}" up -d --remove-orphans --pull never "${stack_services[@]}"

if [[ "${ENABLE_EMBEDDING,,}" =~ ^(1|true|yes|on)$ ]]; then
  embedding_endpoint="$("${compose[@]}" port embedding 80 | tail -n 1)"
  if [[ -z "$embedding_endpoint" ]]; then
    echo "Could not resolve published embedding port from Docker Compose."
    "${compose[@]}" ps
    exit 1
  fi

  echo "Waiting for embedding health at http://$embedding_endpoint/health ..."
  for _ in $(seq 1 120); do
    if curl -fsS "http://$embedding_endpoint/health" >/dev/null; then
      embedding_ok=true
      break
    fi
    sleep 5
  done

  if [[ "${embedding_ok:-false}" != "true" ]]; then
    echo "Embedding health check failed."
    "${compose[@]}" ps
    exit 1
  fi
fi

api_endpoint="$("${compose[@]}" port api 8080 | tail -n 1)"
web_endpoint="$("${compose[@]}" port web 80 | tail -n 1)"

if [[ -z "$api_endpoint" || -z "$web_endpoint" ]]; then
  echo "Could not resolve published API/Web ports from Docker Compose."
  "${compose[@]}" ps
  exit 1
fi

echo "Waiting for API health at http://$api_endpoint/api/health ..."
for _ in $(seq 1 30); do
  if curl -fsS "http://$api_endpoint/api/health" >/dev/null; then
    api_ok=true
    break
  fi
  sleep 2
done

if [[ "${api_ok:-false}" != "true" ]]; then
  echo "API health check failed."
  "${compose[@]}" ps
  exit 1
fi

echo "Checking Web health at http://$web_endpoint/health ..."
curl -fsS "http://$web_endpoint/health" >/dev/null

"${compose[@]}" ps
echo "Production deploy completed."
