import { describe, it, expect } from 'vitest'
import { Clock } from '@/shared/kernel/Clock'
import { DomainEvent } from '@/shared/kernel/DomainEvent'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { MarkReadService } from '@/contexts/notifications/application/use-cases/MarkReadService'
import { NotificationRepository, UnreadNotificationItem } from '@/contexts/notifications/application/ports/out/NotificationRepository'
import { Notification } from '@/contexts/notifications/domain/Notification'
import { NotificationId, UserId } from '@/contexts/notifications/domain/ids'
import { NotificationKind } from '@/contexts/notifications/domain/NotificationKind'

const NOW = new Date('2024-01-01T00:00:00.000Z')
const clock: Clock = { now: () => NOW }

function makeNotification(id: string, userId: string): Notification {
  const kind = NotificationKind.of('task_assigned')
  if (!kind.ok) throw new Error('bad kind')
  const created = Notification.create({
    id: NotificationId.of(id),
    userId: UserId.of(userId),
    kind: kind.value,
    title: 'Hello',
    body: null,
    taskId: null,
    now: new Date('2023-12-01T00:00:00.000Z'),
  })
  if (!created.ok) throw new Error('bad notification')
  created.value.pullEvents() // drop the NotificationCreated event from setup
  return created.value
}

class FakeNotificationRepo implements NotificationRepository {
  saved: Notification[] = []
  constructor(private readonly byId = new Map<string, Notification>()) {}
  seed(n: Notification): void {
    this.byId.set(n.id.value, n)
  }
  nextId(): NotificationId {
    return NotificationId.of('n')
  }
  async findById(id: NotificationId): Promise<Notification | null> {
    return this.byId.get(id.value) ?? null
  }
  async save(notification: Notification): Promise<void> {
    this.saved.push(notification)
  }
  async markAllReadForUser(): Promise<void> {}
  async findUnreadForUserSince(): Promise<UnreadNotificationItem[]> {
    return []
  }
  async unreadRecipientIds(): Promise<UserId[]> {
    return []
  }
}

class FakeEventPublisher implements EventPublisher {
  published: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.published.push(...events)
  }
}

describe('MarkReadService', () => {
  it('marks the owned notification read, persists, and publishes NotificationRead', async () => {
    const notif = makeNotification('notif-1', 'user-1')
    const repo = new FakeNotificationRepo()
    repo.seed(notif)
    const events = new FakeEventPublisher()
    const svc = new MarkReadService(repo, events, clock)

    const res = await svc.execute({ id: 'notif-1', userId: 'user-1' })

    expect(res.ok).toBe(true)
    expect(notif.readAt).toEqual(NOW)
    expect(repo.saved).toEqual([notif])
    expect(events.published.some((e) => e.name === 'notifications.NotificationRead')).toBe(true)
  })

  it('is a silent no-op success when the notification belongs to another user', async () => {
    const notif = makeNotification('notif-1', 'owner')
    const repo = new FakeNotificationRepo()
    repo.seed(notif)
    const events = new FakeEventPublisher()
    const svc = new MarkReadService(repo, events, clock)

    const res = await svc.execute({ id: 'notif-1', userId: 'intruder' })

    expect(res.ok).toBe(true)
    expect(notif.readAt).toBeNull()
    expect(repo.saved).toHaveLength(0)
    expect(events.published).toHaveLength(0)
  })

  it('is a silent no-op success when the notification is missing', async () => {
    const repo = new FakeNotificationRepo()
    const events = new FakeEventPublisher()
    const svc = new MarkReadService(repo, events, clock)

    const res = await svc.execute({ id: 'ghost', userId: 'user-1' })

    expect(res.ok).toBe(true)
    expect(repo.saved).toHaveLength(0)
    expect(events.published).toHaveLength(0)
  })

  it('does not re-emit when an already-read notification is marked again (idempotent)', async () => {
    const notif = makeNotification('notif-1', 'user-1')
    notif.markRead(new Date('2023-12-15T00:00:00.000Z'))
    notif.pullEvents()
    const repo = new FakeNotificationRepo()
    repo.seed(notif)
    const events = new FakeEventPublisher()
    const svc = new MarkReadService(repo, events, clock)

    const res = await svc.execute({ id: 'notif-1', userId: 'user-1' })

    expect(res.ok).toBe(true)
    // readAt keeps the first instant; no second event published.
    expect(notif.readAt).toEqual(new Date('2023-12-15T00:00:00.000Z'))
    expect(events.published).toHaveLength(0)
  })
})
