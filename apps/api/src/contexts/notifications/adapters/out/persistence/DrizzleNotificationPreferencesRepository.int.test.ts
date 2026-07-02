import { randomUUID } from 'node:crypto'
import { beforeAll, expect, it } from 'vitest'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import { DrizzleNotificationPreferencesRepository } from '@/contexts/notifications/adapters/out/persistence/DrizzleNotificationPreferencesRepository'
import { NotificationPreferences } from '@/contexts/notifications/domain/NotificationPreferences'
import { UserId } from '@/contexts/notifications/domain/ids'

describeIntegration('DrizzleNotificationPreferencesRepository (integration)', () => {
  let db: Database
  let repo: DrizzleNotificationPreferencesRepository
  beforeAll(() => {
    db = getTestDb()
    repo = new DrizzleNotificationPreferencesRepository(db)
  })

  async function seedUser(): Promise<string> {
    const id = `u-${randomUUID()}`
    await db.insert(schema.users).values({ id, name: 'T', email: `${id}@t.io`, emailVerified: false })
    return id
  }

  it('returns null when the user has no preferences row', async () => {
    const userId = await seedUser()
    expect(await repo.findByUserId(UserId.of(userId))).toBeNull()
  })

  it('saves and round-trips the default preferences (digest on, never sent)', async () => {
    const userId = await seedUser()
    const now = new Date('2024-01-01T00:00:00.000Z')
    await repo.save(NotificationPreferences.createDefault(UserId.of(userId), now))

    const loaded = await repo.findByUserId(UserId.of(userId))
    expect(loaded).not.toBeNull()
    expect(loaded!.emailDigest).toBe(true)
    expect(loaded!.lastDigestSentAt).toBeNull()
    expect(loaded!.updatedAt).toEqual(now)
  })

  it('upserts an existing row (ON CONFLICT on the user PK)', async () => {
    const userId = await seedUser()
    const prefs = NotificationPreferences.createDefault(UserId.of(userId), new Date('2024-01-01T00:00:00.000Z'))
    await repo.save(prefs)

    prefs.setEmailDigest(false, new Date('2024-02-01T00:00:00.000Z'))
    prefs.markDigestSent(new Date('2024-02-02T00:00:00.000Z'))
    await repo.save(prefs)

    const loaded = await repo.findByUserId(UserId.of(userId))
    expect(loaded!.emailDigest).toBe(false)
    expect(loaded!.lastDigestSentAt).toEqual(new Date('2024-02-02T00:00:00.000Z'))
    expect(loaded!.updatedAt).toEqual(new Date('2024-02-02T00:00:00.000Z'))
  })
})
