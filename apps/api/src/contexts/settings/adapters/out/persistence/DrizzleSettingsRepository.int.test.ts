import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import { DrizzleSettingsRepository } from '@/contexts/settings/adapters/out/persistence/DrizzleSettingsRepository'

// Adapter integration test against a REAL Postgres. Parallel-safe: each test
// uses a unique settings key (randomUUID) so it never collides with rows from
// other concurrently-running test files and never assumes an empty table.
describeIntegration('DrizzleSettingsRepository (integration)', () => {
  let db: Database
  let repo: DrizzleSettingsRepository
  beforeAll(() => {
    db = getTestDb()
    repo = new DrizzleSettingsRepository(db)
  })

  it('returns null for a missing key', async () => {
    const v = await repo.find(`missing.${randomUUID()}`)
    expect(v).toBeNull()
  })

  it('round-trips an inserted value', async () => {
    const key = `company.orgName.${randomUUID()}`
    await repo.upsert(key, 'Buenaça', new Date('2024-01-01T00:00:00.000Z'))
    expect(await repo.find(key)).toBe('Buenaça')
  })

  it('upsert overwrites the value of an existing key (ON CONFLICT)', async () => {
    const key = `theme.${randomUUID()}`
    await repo.upsert(key, 'light', new Date('2024-01-01T00:00:00.000Z'))
    await repo.upsert(key, 'dark', new Date('2024-02-01T00:00:00.000Z'))
    expect(await repo.find(key)).toBe('dark')
  })
})
