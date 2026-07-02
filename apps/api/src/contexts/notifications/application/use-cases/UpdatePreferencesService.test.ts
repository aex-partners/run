import { describe, it, expect } from 'vitest'
import { Clock } from '@/shared/kernel/Clock'
import { UpdatePreferencesService } from '@/contexts/notifications/application/use-cases/UpdatePreferencesService'
import { NotificationPreferencesRepository } from '@/contexts/notifications/application/ports/out/NotificationPreferencesRepository'
import { NotificationPreferences } from '@/contexts/notifications/domain/NotificationPreferences'
import { UserId } from '@/contexts/notifications/domain/ids'

const NOW = new Date('2024-01-01T00:00:00.000Z')
const clock: Clock = { now: () => NOW }

class FakePreferencesRepo implements NotificationPreferencesRepository {
  saved: NotificationPreferences[] = []
  constructor(private readonly byUser = new Map<string, NotificationPreferences>()) {}
  seed(userId: string, prefs: NotificationPreferences): void {
    this.byUser.set(userId, prefs)
  }
  async findByUserId(userId: UserId): Promise<NotificationPreferences | null> {
    return this.byUser.get(userId.value) ?? null
  }
  async save(prefs: NotificationPreferences): Promise<void> {
    this.saved.push(prefs)
  }
}

describe('UpdatePreferencesService', () => {
  it('materialises the default row then applies the toggle when none exists', async () => {
    const repo = new FakePreferencesRepo()
    const svc = new UpdatePreferencesService(repo, clock)

    const res = await svc.execute({ userId: 'user-1', emailDigest: false })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value).toEqual({ emailDigest: false })
    expect(repo.saved).toHaveLength(1)
    expect(repo.saved[0].id.value).toBe('user-1')
    expect(repo.saved[0].emailDigest).toBe(false)
    expect(repo.saved[0].updatedAt).toEqual(NOW)
  })

  it('updates an existing preference row in place', async () => {
    const existing = NotificationPreferences.rehydrate(
      UserId.of('user-1'),
      false,
      new Date('2023-12-01T00:00:00.000Z'),
      new Date('2023-12-01T00:00:00.000Z'),
    )
    const repo = new FakePreferencesRepo()
    repo.seed('user-1', existing)
    const svc = new UpdatePreferencesService(repo, clock)

    const res = await svc.execute({ userId: 'user-1', emailDigest: true })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value).toEqual({ emailDigest: true })
    expect(repo.saved).toEqual([existing])
    expect(existing.emailDigest).toBe(true)
    expect(existing.updatedAt).toEqual(NOW)
    // The prior digest stamp is preserved across a preference toggle.
    expect(existing.lastDigestSentAt).toEqual(new Date('2023-12-01T00:00:00.000Z'))
  })
})
