#!/usr/bin/env bash
# Sync schema + seed + Buenaça demo data + team users on Railway staging.
# Requires: railway CLI logged in, project linked, Postgres + API services in the environment.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PUB="$(RAILWAY_SERVICE=postgres railway run -- printenv DATABASE_PUBLIC_URL | tr -d '\r\n')"
if [[ -z "$PUB" ]]; then
  echo "Could not read DATABASE_PUBLIC_URL from Postgres service."
  exit 1
fi

run_db() {
  local cmd="$1"
  RAILWAY_SERVICE=api railway run -- bash -c "export DATABASE_URL=\"$PUB\" && cd \"$ROOT\" && $cmd"
}

echo "==> drizzle-kit push (public DB URL)"
run_db "npm run db:push -w @aex/api"

echo "==> db:seed (admin@aex.app)"
run_db "npm run db:seed -w @aex/api"

echo "==> db:seed-buenaca"
run_db "npm run db:seed-buenaca -w @aex/api"

echo "==> db:provision-staging (Sandro/Sendi + Eric backfill)"
run_db "npm run db:provision-staging -w @aex/api"

echo "==> Railway staging sync finished."
