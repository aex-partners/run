// Driving adapter (CLI). One-shot runner for the Bling full-mirror sync — the
// same SyncBlingMirror in-port the tRPC `bling.sync.run` mutation and the 6h
// BullMQ repeatable job call. Bootstraps the real composition root exactly like
// main/server.ts does (env/db/redis/auth -> buildContainer), then drives the
// sync once and exits. Useful for a manual/cron-outside-the-app import, or to
// backfill the mirror before the app is deployed.
//
//   npm run db:import-bling                  -- full mirror
//   npm run db:import-bling categorias        -- just the categorias slice
//   npm run db:import-bling -- --limit 50     -- cap detail fetches per entity
import { loadEnv } from '@/platform/config/env'
import { makeDb } from '@/platform/db/client'
import { makeRedis } from '@/platform/queue/connection'
import { makeAuth } from '@/platform/auth/better-auth'
import { buildContainer } from '@/main/container'
import { SyncSummary } from '@/contexts/bling/application/ports/in/SyncBlingMirror'

function parseArgs(argv: string[]): { scope: 'all' | 'categorias'; limit?: number } {
  const scope = argv[2] === 'categorias' ? 'categorias' : 'all'
  const limitFlagIdx = argv.indexOf('--limit')
  const limit = limitFlagIdx >= 0 ? Number(argv[limitFlagIdx + 1]) : undefined
  return { scope, limit: Number.isFinite(limit) ? limit : undefined }
}

function printSummary(summary: SyncSummary): void {
  console.table(
    summary.entities.map((e) => ({
      entity: e.slug,
      inserted: e.inserted,
      updated: e.updated,
      skipped: e.skipped,
      errors: e.errors,
    })),
  )
}

async function main() {
  const { scope, limit } = parseArgs(process.argv)

  const env = loadEnv()
  const db = makeDb(env.DATABASE_URL)
  const redis = makeRedis(env.REDIS_URL)
  const auth = makeAuth(db, env)
  const container = buildContainer(db, redis, env, auth)

  console.log(`[bling:import] starting sync (scope=${scope}${limit ? `, limit=${limit}` : ''})`)
  const result = await container.workerPorts.syncBlingMirror.execute({ scope, limit })

  if (!result.ok) {
    console.error(`[bling:import] sync failed: ${result.error}`)
    process.exit(1)
  }

  printSummary(result.value)
  console.log('[bling:import] done')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
