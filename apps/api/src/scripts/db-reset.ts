// Wipe the public schema so a one-time clean reseed can run. Used by the container
// entrypoint on first boot (guarded by a marker on the uploads volume) to clear the
// duplicate conversations/channels left by the old seed-on-every-boot behavior.
// Terminates other backends first so DROP SCHEMA doesn't block on the old
// deployment's still-open connections during a rolling deploy.
import postgres from 'postgres'
import { loadEnv } from '@/platform/config/env'

async function main() {
  const env = loadEnv()
  const sql = postgres(env.DATABASE_URL, { max: 1 })
  try {
    await sql`SET lock_timeout = '8s'`
    await sql`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid()`
    await sql`DROP SCHEMA IF EXISTS public CASCADE`
    // drizzle keeps its migration journal in the `drizzle` schema; drop it too or
    // `drizzle-kit migrate` sees 0000 as already applied and recreates no tables.
    await sql`DROP SCHEMA IF EXISTS drizzle CASCADE`
    await sql`CREATE SCHEMA public`
    console.log('[db-reset] public + drizzle schemas recreated')
  } finally {
    await sql.end()
  }
}

main().catch((err) => {
  console.error('[db-reset] failed', err)
  process.exit(1)
})
