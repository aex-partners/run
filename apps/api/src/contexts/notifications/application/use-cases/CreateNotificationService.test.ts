import { describe, it, expect } from 'vitest'
import { Clock } from '@/shared/kernel/Clock'
import { DomainEvent } from '@/shared/kernel/DomainEvent'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { CreateNotificationService } from '@/contexts/notifications/application/use-cases/CreateNotificationService'
import { NotificationRepository, UnreadNotificationItem } from '@/contexts/notifications/application/ports/out/NotificationRepository'
import { Notification } from '@/contexts/notifications/domain/Notification'
import { NotificationId, UserId } from '@/contexts/notifications/domain/ids'

const NOW = new Date('2024-01-01T00:00:00.000Z')
const clock: Clock = { now: () => NOW }

class FakeNotificationRepo implements NotificationRepository {
  saved: Notification[] = []
  private seq = 0
  nextId(): NotificationId {
    return NotificationId.of(`notif-${++this.seq}`)
  }
  async findById(): Promise<Notification | null> {
    return null
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

describe('CreateNotificationService', () => {
  it('persists the notification and publishes NotificationCreated', async () => {
    const repo = new FakeNotificationRepo()
    const events = new FakeEventPublisher()
    const svc = new CreateNotificationService(repo, events, clock)

    const res = await svc.execute({
      userId: 'user-1',
      kind: 'task_assigned',
      title: 'You have a task',
      body: 'Please do it',
      taskId: 'task-9',
    })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.id).toBe('notif-1')
    expect(repo.saved).toHaveLength(1)
    expect(repo.saved[0].title).toBe('You have a task')
    expect(repo.saved[0].taskId?.value).toBe('task-9')
    expect(events.published.some((e) => e.name === 'notifications.NotificationCreated')).toBe(true)
    // pullEvents drained the aggregate after publish.
    expect(repo.saved[0].pullEvents()).toHaveLength(0)
  })

  it('defaults body and taskId to null when omitted', async () => {
    const repo = new FakeNotificationRepo()
    const svc = new CreateNotificationService(repo, new FakeEventPublisher(), clock)

    const res = await svc.execute({ userId: 'u', kind: 'reminder_fired', title: 'Ping' })

    expect(res.ok).toBe(true)
    expect(repo.saved[0].body).toBeNull()
    expect(repo.saved[0].taskId).toBeNull()
  })

  it('rejects an unknown kind before touching the repository', async () => {
    const repo = new FakeNotificationRepo()
    const events = new FakeEventPublisher()
    const svc = new CreateNotificationService(repo, events, clock)

    const res = await svc.execute({ userId: 'u', kind: 'bogus', title: 'x' })

    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toContain('unknown kind')
    expect(repo.saved).toHaveLength(0)
    expect(events.published).toHaveLength(0)
  })

  it('propagates the domain title-required rule and persists nothing', async () => {
    const repo = new FakeNotificationRepo()
    const events = new FakeEventPublisher()
    const svc = new CreateNotificationService(repo, events, clock)

    const res = await svc.execute({ userId: 'u', kind: 'task_assigned', title: '   ' })

    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toContain('title is required')
    expect(repo.saved).toHaveLength(0)
    expect(events.published).toHaveLength(0)
  })
})
