#!/usr/bin/env bash
# Dispara a Deployment Trigger URL de cada servico no Easypanel e espera o smoke passar.
# Entradas (env): DEPLOY_URL_API, DEPLOY_URL_WEB, DEPLOY_URL_WORKER (opcional), SMOKE_API_URL, SMOKE_WEB_URL.
# URL vazia = servico ainda nao criado (primeiro deploy): pula o disparo, sem falhar.
set -euo pipefail

trigger() {
  local name="$1" url="$2"
  if [ -z "$url" ]; then
    echo "[$name] URL de deploy vazia; pulando disparo."
    return 0
  fi
  echo "[$name] disparando deploy"
  curl -fsS -X POST --max-time 30 --retry 2 -o /dev/null "$url" ||
    curl -fsS --max-time 30 --retry 2 -o /dev/null "$url"
}

wait_ok() {
  local label="$1" url="$2" deadline=$((SECONDS + 600))
  until curl -fsS --max-time 10 -o /dev/null "$url"; do
    if [ "$SECONDS" -ge "$deadline" ]; then
      echo "[$label] timeout esperando $label" >&2
      return 1
    fi
    sleep 10
  done
  echo "[$label] ok"
}

trigger api "${DEPLOY_URL_API:-}"
trigger worker "${DEPLOY_URL_WORKER:-}"

if [ -n "${SMOKE_API_URL:-}" ]; then
  sleep 20
  wait_ok "api /ready" "${SMOKE_API_URL%/}/ready"
fi

trigger web "${DEPLOY_URL_WEB:-}"

if [ -n "${SMOKE_WEB_URL:-}" ]; then
  sleep 20
  wait_ok "web" "${SMOKE_WEB_URL%/}/"
fi

if [ -n "${SMOKE_API_URL:-}" ]; then
  curl -fsS --max-time 10 -o /dev/null "${SMOKE_API_URL%/}/health"
  echo "[api /health] ok"
fi
