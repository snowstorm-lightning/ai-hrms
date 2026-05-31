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

compose=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

echo "Validating production compose config..."
"${compose[@]}" config >/dev/null

echo "Pulling production images..."
"${compose[@]}" pull

echo "Starting production stack..."
"${compose[@]}" up -d --remove-orphans

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
