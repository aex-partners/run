import { randomUUID } from 'node:crypto'
import { beforeAll, expect, it } from 'vitest'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import { DrizzleGetUnreadCount } from '@/contexts/notifications/adapters/out/persistence/DrizzleGetUnreadCount'

describeIntegration('DrizzleGetUnreadCount (integration)', () => {
  let db: Database
  let query: DrizzleGetUnreadCount
  beforeAll(() => {
    db = getTestDb()
    query = new DrizzleGetUnreadCount(db)
  })

  async function seedUser(): Promise<string> {
    const id = `u-${randomUUID()}`
    await db.insert(schema.users).values({ id, name: 'T', email: `${id}@t.io`, emailVerified: false })
    return id
  }

  async function seedNotif(userId: string, readAt: Date | null): Promise<void> {
    await db.insert(schema.notifications).values({
      id: randomUUID(),
      userId,
      kind: 'task_assigned',
      taskId: null,
      title: 'T',
      body: null,
      readAt,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    })
  }

  it('returns 0 for a user with no notifications', async () => {
    const userId = await seedUser()
    expect(await query.execute({ userId })).toBe(0)
  })

  it('counts only the unread notifications of that user', async () => {
    const userId = await seedUser()
    const otherUser = await seedUser()
    await seedNotif(userId, null) // unread
    await seedNotif(userId, null) // unread
    await seedNotif(userId, new Date('2024-02-01T00:00:00.000Z')) // read
    await seedNotif(otherUser, null) // belongs to another user

    expect(await query.execute({ userId })).toBe(2)
  })
})
