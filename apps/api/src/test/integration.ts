import { sql } from 'drizzle-orm'
import { describe } from 'vitest'
import { makeDb, Database } from '@/platform/db/client'

// Integration-test harness. Adapter tests run against a REAL Postgres only when
// TEST_DATABASE_URL is set (e.g. the aex_test database); otherwise they skip, so
// the pure unit suite stays green without infra.
//
//   TEST_DATABASE_URL=postgres://aex:aex@localhost:55432/aex_test npx vitest run
//
export const TEST_DB_URL = process.env.TEST_DATABASE_URL
export const hasTestDb = !!TEST_DB_URL

// Use in place of `describe` for adapter/integration suites.
export const describeIntegration = hasTestDb ? describe : describe.skip

let cached: Database | null = null
export function getTestDb(): Database {
  if (!TEST_DB_URL) throw new Error('TEST_DATABASE_URL not set')
  if (!cached) cached = makeDb(TEST_DB_URL)
  return cached
}

// Truncate every public table (RESTART IDENTITY CASCADE) for a clean slate.
// Call in beforeEach so tests are order-independent.
export async function resetDb(db: Database = getTestDb()): Promise<void> {
  const rows = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  )
  const tables = (rows as unknown as { tablename: string }[]).map((r) => `"${r.tablename}"`)
  if (tables.length === 0) return
  await db.execute(sql.raw(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`))
}
