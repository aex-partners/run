#!/bin/sh
# Container boot. Invoked as `sh docker-entrypoint.sh` (Railway execs the start
# command without a shell, which would break inline && / cd).
#
# Seeding is ONE-TIME, guarded by a marker on the persistent /app/uploads volume.
# The old "seed on every boot" duplicated conversations/channels each restart, so
# on first boot we reset the schema, then seed once. The heavy Buenaça CSV import
# runs in the background so the server binds immediately and the healthcheck passes.
set -e
cd /app/apps/api

MARKER=/app/uploads/.seeded

if [ -f "$MARKER" ]; then
  echo "[boot] already seeded; running migrations only"
  npx drizzle-kit migrate
else
  echo "[boot] first boot: resetting schema for a clean seed"
  npx tsx src/scripts/db-reset.ts
  npx drizzle-kit migrate
  echo "[boot] seeding in background"
  (
    npx tsx src/scripts/seed-buenaca.ts || echo "[boot] seed-buenaca failed"
    npx tsx src/scripts/seed-team.ts || echo "[boot] seed-team failed"
    touch "$MARKER"
    echo "[boot] seed complete"
  ) &
fi

echo "[boot] starting api"
exec npx tsx src/index.ts
