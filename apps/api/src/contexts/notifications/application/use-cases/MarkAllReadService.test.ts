import { describe, it, expect } from 'vitest'
import { Clock } from '@/shared/kernel/Clock'
import { MarkAllReadService } from '@/contexts/notifications/application/use-cases/MarkAllReadService'
import { NotificationRepository, UnreadNotificationItem } from '@/contexts/notifications/application/ports/out/NotificationRepository'
import { Notification } from '@/contexts/notifications/domain/Notification'
import { NotificationId, UserId } from '@/contexts/notifications/domain/ids'

const NOW = new Date('2024-01-01T00:00:00.000Z')
const clock: Clock = { now: () => NOW }

class FakeNotificationRepo implements NotificationRepository {
  markAllCalls: { userId: string; now: Date }[] = []
  nextId(): NotificationId {
    return NotificationId.of('n')
  }
  async findById(): Promise<Notification | null> {
    return null
  }
  async save(): Promise<void> {}
  async markAllReadForUser(userId: UserId, now: Date): Promise<void> {
    this.markAllCalls.push({ userId: userId.value, now })
  }
  async findUnreadForUserSince(): Promise<UnreadNotificationItem[]> {
    return []
  }
  async unreadRecipientIds(): Promise<UserId[]> {
    return []
  }
}

describe('MarkAllReadService', () => {
  it('delegates the bulk transition to the repository with the clock instant', async () => {
    const repo = new FakeNotificationRepo()
    const svc = new MarkAllReadService(repo, clock)

    const res = await svc.execute({ userId: 'user-7' })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.success).toBe(true)
    expect(repo.markAllCalls).toEqual([{ userId: 'user-7', now: NOW }])
  })
})
