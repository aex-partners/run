import { randomUUID } from 'node:crypto'
import { beforeAll, expect, it } from 'vitest'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import { DrizzleGetPreferences } from '@/contexts/notifications/adapters/out/persistence/DrizzleGetPreferences'

describeIntegration('DrizzleGetPreferences (integration)', () => {
  let db: Database
  let query: DrizzleGetPreferences
  beforeAll(() => {
    db = getTestDb()
    query = new DrizzleGetPreferences(db)
  })

  async function seedUser(): Promise<string> {
    const id = `u-${randomUUID()}`
    await db.insert(schema.users).values({ id, name: 'T', email: `${id}@t.io`, emailVerified: false })
    return id
  }

  it('coalesces a missing row to enabled (default)', async () => {
    const userId = await seedUser()
    expect(await query.execute({ userId })).toEqual({ emailDigest: true })
  })

  it('reads a stored disabled preference', async () => {
    const userId = await seedUser()
    await db.insert(schema.notificationPreferences).values({
      userId,
      emailDigest: false,
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    })
    expect(await query.execute({ userId })).toEqual({ emailDigest: false })
  })

  it('reads a stored enabled preference', async () => {
    const userId = await seedUser()
    await db.insert(schema.notificationPreferences).values({
      userId,
      emailDigest: true,
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    })
    expect(await query.execute({ userId })).toEqual({ emailDigest: true })
  })
})
