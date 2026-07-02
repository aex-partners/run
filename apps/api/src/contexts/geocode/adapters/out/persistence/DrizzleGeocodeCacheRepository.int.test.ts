import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import { geocodeCache } from '@/platform/db/schema'
import { DrizzleGeocodeCacheRepository } from '@/contexts/geocode/adapters/out/persistence/DrizzleGeocodeCacheRepository'

// Adapter integration test against a REAL Postgres. Parallel-safe: every test
// keys its rows under a unique query string (randomUUID) and reads back only
// its own keys, so it never relies on the table being empty and never collides
// with rows written by other test files running concurrently.
describeIntegration('DrizzleGeocodeCacheRepository (integration)', () => {
  let db: Database
  let repo: DrizzleGeocodeCacheRepository
  beforeAll(() => {
    db = getTestDb()
    repo = new DrizzleGeocodeCacheRepository(db)
  })

  it('returns null for an address that was never cached', async () => {
    const r = await repo.find(`unknown-${randomUUID()}`)
    expect(r).toBeNull()
  })

  it('round-trips a geocode hit', async () => {
    const q = `hit-${randomUUID()}`
    await repo.save(q, { lat: -23.5505, lng: -46.6333 })
    const r = await repo.find(q)
    expect(r).toEqual({ lat: -23.5505, lng: -46.6333 })
  })

  it('persists a recorded miss as a row with null coords', async () => {
    const q = `miss-${randomUUID()}`
    await repo.save(q, null)
    // A row exists (so find returns a non-null CachedCoords) but coords are null.
    const r = await repo.find(q)
    expect(r).not.toBeNull()
    expect(r).toEqual({ lat: null, lng: null })
    const rows = await db.select().from(geocodeCache).where(eq(geocodeCache.query, q))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.provider).toBe('nominatim')
  })

  it('save is a no-op when a row already exists (onConflictDoNothing)', async () => {
    const q = `dup-${randomUUID()}`
    await repo.save(q, { lat: 1, lng: 2 })
    await repo.save(q, { lat: 9, lng: 9 })
    const r = await repo.find(q)
    expect(r).toEqual({ lat: 1, lng: 2 })
  })
})
