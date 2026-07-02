import { randomUUID } from 'node:crypto'
import { beforeAll, expect, it } from 'vitest'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import { DrizzleListNotifications } from '@/contexts/notifications/adapters/out/persistence/DrizzleListNotifications'

describeIntegration('DrizzleListNotifications (integration)', () => {
  let db: Database
  let query: DrizzleListNotifications
  beforeAll(() => {
    db = getTestDb()
    query = new DrizzleListNotifications(db)
  })

  async function seedUser(): Promise<string> {
    const id = `u-${randomUUID()}`
    await db.insert(schema.users).values({ id, name: 'T', email: `${id}@t.io`, emailVerified: false })
    return id
  }

  async function seedNotif(userId: string, createdAt: Date, title: string): Promise<string> {
    const id = randomUUID()
    await db.insert(schema.notifications).values({
      id,
      userId,
      kind: 'reminder_fired',
      taskId: null,
      title,
      body: null,
      readAt: null,
      createdAt,
    })
    return id
  }

  it('returns a user\'s notifications newest first as a flat view', async () => {
    const userId = await seedUser()
    await seedNotif(userId, new Date('2024-01-01T00:00:00.000Z'), 'oldest')
    await seedNotif(userId, new Date('2024-01-02T00:00:00.000Z'), 'middle')
    await seedNotif(userId, new Date('2024-01-03T00:00:00.000Z'), 'newest')

    const rows = await query.execute({ userId })

    expect(rows.map((r) => r.title)).toEqual(['newest', 'middle', 'oldest'])
    expect(rows[0]).toMatchObject({ userId, kind: 'reminder_fired', taskId: null, readAt: null })
    expect(rows[0].createdAt).toEqual(new Date('2024-01-03T00:00:00.000Z'))
  })

  it('does not return another user\'s notifications', async () => {
    const userId = await seedUser()
    const otherUser = await seedUser()
    const mine = await seedNotif(userId, new Date('2024-01-01T00:00:00.000Z'), 'mine')
    await seedNotif(otherUser, new Date('2024-01-01T00:00:00.000Z'), 'theirs')

    const rows = await query.execute({ userId })

    expect(rows.map((r) => r.id)).toEqual([mine])
  })

  it('respects the limit, keeping the newest rows', async () => {
    const userId = await seedUser()
    await seedNotif(userId, new Date('2024-01-01T00:00:00.000Z'), 'a')
    await seedNotif(userId, new Date('2024-01-02T00:00:00.000Z'), 'b')
    await seedNotif(userId, new Date('2024-01-03T00:00:00.000Z'), 'c')

    const rows = await query.execute({ userId, limit: 2 })

    expect(rows.map((r) => r.title)).toEqual(['c', 'b'])
  })
})
