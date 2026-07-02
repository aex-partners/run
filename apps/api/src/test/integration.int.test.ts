import { beforeAll, beforeEach, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { describeIntegration, getTestDb, resetDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'

// PATTERN for adapter integration tests: resolve the db lazily in beforeAll
// (skipped suites never run hooks, so getTestDb() is not called without a DB).
describeIntegration('integration harness', () => {
  let db: Database
  beforeAll(() => {
    db = getTestDb()
  })
  beforeEach(() => resetDb(db))

  it('writes and reads a row', async () => {
    await db.insert(schema.settings).values({ key: 'company.orgName', value: 'Buenaça' })
    const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, 'company.orgName'))
    expect(row?.value).toBe('Buenaça')
  })

  it('starts each test clean (previous row gone)', async () => {
    const rows = await db.select().from(schema.settings)
    expect(rows.length).toBe(0)
  })
})
