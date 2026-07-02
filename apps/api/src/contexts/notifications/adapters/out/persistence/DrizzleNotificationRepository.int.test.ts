import { randomUUID } from 'node:crypto'
import { beforeAll, expect, it } from 'vitest'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import { DrizzleNotificationRepository } from '@/contexts/notifications/adapters/out/persistence/DrizzleNotificationRepository'
import { Notification } from '@/contexts/notifications/domain/Notification'
import { NotificationKind } from '@/contexts/notifications/domain/NotificationKind'
import { NotificationId, UserId } from '@/contexts/notifications/domain/ids'

// Parallel-safe: every row uses randomUUID ids and assertions are scoped to the
// ids/users this file created. No truncation, no whole-table counts.
describeIntegration('DrizzleNotificationRepository (integration)', () => {
  let db: Database
  let repo: DrizzleNotificationRepository
  beforeAll(() => {
    db = getTestDb()
    repo = new DrizzleNotificationRepository(db)
  })

  async function seedUser(): Promise<string> {
    const id = `u-${randomUUID()}`
    await db.insert(schema.users).values({ id, name: 'T', email: `${id}@t.io`, emailVerified: false })
    return id
  }

  function makeNotif(opts: { id?: string; userId: string; createdAt: Date; title?: string }): Notification {
    const kind = NotificationKind.of('task_assigned')
    if (!kind.ok) throw new Error('bad kind')
    const created = Notification.create({
      id: NotificationId.of(opts.id ?? randomUUID()),
      userId: UserId.of(opts.userId),
      kind: kind.value,
      title: opts.title ?? 'Title',
      body: 'Body',
      taskId: null,
      now: opts.createdAt,
    })
    if (!created.ok) throw new Error('bad notification')
    return created.value
  }

  it('round-trips a saved notification through findById', async () => {
    const userId = await seedUser()
    const notif = makeNotif({ userId, createdAt: new Date('2024-01-01T00:00:00.000Z') })
    await repo.save(notif)

    const loaded = await repo.findById(notif.id)
    expect(loaded).not.toBeNull()
    expect(loaded!.id.value).toBe(notif.id.value)
    expect(loaded!.userId.value).toBe(userId)
    expect(loaded!.kind.value).toBe('task_assigned')
    expect(loaded!.title).toBe('Title')
    expect(loaded!.body).toBe('Body')
    expect(loaded!.isRead()).toBe(false)
  })

  it('returns null for an unknown id', async () => {
    expect(await repo.findById(NotificationId.of(`missing-${randomUUID()}`))).toBeNull()
  })

  it('save upserts the read-once transition (readAt) without overwriting createdAt', async () => {
    const userId = await seedUser()
    const createdAt = new Date('2024-01-01T00:00:00.000Z')
    const notif = makeNotif({ userId, createdAt })
    await repo.save(notif)

    notif.markRead(new Date('2024-01-02T00:00:00.000Z'))
    await repo.save(notif)

    const loaded = await repo.findById(notif.id)
    expect(loaded!.isRead()).toBe(true)
    expect(loaded!.readAt).toEqual(new Date('2024-01-02T00:00:00.000Z'))
    expect(loaded!.createdAt).toEqual(createdAt)
  })

  it('markAllReadForUser marks only that user\'s unread rows read', async () => {
    const userId = await seedUser()
    const otherUser = await seedUser()
    const mine1 = makeNotif({ userId, createdAt: new Date('2024-01-01T00:00:00.000Z') })
    const mine2 = makeNotif({ userId, createdAt: new Date('2024-01-02T00:00:00.000Z') })
    const theirs = makeNotif({ userId: otherUser, createdAt: new Date('2024-01-01T00:00:00.000Z') })
    await repo.save(mine1)
    await repo.save(mine2)
    await repo.save(theirs)

    await repo.markAllReadForUser(UserId.of(userId), new Date('2024-02-01T00:00:00.000Z'))

    expect((await repo.findById(mine1.id))!.isRead()).toBe(true)
    expect((await repo.findById(mine2.id))!.isRead()).toBe(true)
    // The other user's notification is untouched.
    expect((await repo.findById(theirs.id))!.isRead()).toBe(false)
  })

  it('findUnreadForUserSince returns unread items strictly after the bound, oldest first', async () => {
    const userId = await seedUser()
    const older = makeNotif({ userId, createdAt: new Date('2024-01-01T00:00:00.000Z'), title: 'older' })
    const mid = makeNotif({ userId, createdAt: new Date('2024-01-03T00:00:00.000Z'), title: 'mid' })
    const newer = makeNotif({ userId, createdAt: new Date('2024-01-05T00:00:00.000Z'), title: 'newer' })
    const read = makeNotif({ userId, createdAt: new Date('2024-01-04T00:00:00.000Z'), title: 'read' })
    read.markRead(new Date('2024-01-06T00:00:00.000Z'))
    await repo.save(older)
    await repo.save(mid)
    await repo.save(newer)
    await repo.save(read)

    const items = await repo.findUnreadForUserSince(UserId.of(userId), new Date('2024-01-02T00:00:00.000Z'))

    // older excluded (before bound), read excluded (already read); oldest first.
    expect(items.map((i) => i.title)).toEqual(['mid', 'newer'])
  })

  it('unreadRecipientIds includes a user with unread and drops them once all are read', async () => {
    const userId = await seedUser()
    const notif = makeNotif({ userId, createdAt: new Date('2024-01-01T00:00:00.000Z') })
    await repo.save(notif)

    const withUnread = await repo.unreadRecipientIds()
    expect(withUnread.map((u) => u.value)).toContain(userId)

    await repo.markAllReadForUser(UserId.of(userId), new Date('2024-02-01T00:00:00.000Z'))
    const afterRead = await repo.unreadRecipientIds()
    expect(afterRead.map((u) => u.value)).not.toContain(userId)
  })
})
