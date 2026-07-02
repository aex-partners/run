import { describe, it, expect } from 'vitest'
import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { RunDigestService } from '@/contexts/notifications/application/use-cases/RunDigestService'
import { NotificationRepository, UnreadNotificationItem } from '@/contexts/notifications/application/ports/out/NotificationRepository'
import { NotificationPreferencesRepository } from '@/contexts/notifications/application/ports/out/NotificationPreferencesRepository'
import { UserDirectory, UserRef } from '@/contexts/notifications/application/ports/out/UserDirectory'
import { EmailSender, DigestEmail } from '@/contexts/notifications/application/ports/out/EmailSender'
import { Notification } from '@/contexts/notifications/domain/Notification'
import { NotificationPreferences } from '@/contexts/notifications/domain/NotificationPreferences'
import { NotificationId, UserId } from '@/contexts/notifications/domain/ids'

const NOW = new Date('2024-01-01T00:00:00.000Z')
const clock: Clock = { now: () => NOW }

class FakeNotificationRepo implements NotificationRepository {
  sinceByUser = new Map<string, Date>()
  constructor(
    private readonly recipients: string[],
    private readonly unreadByUser: Map<string, UnreadNotificationItem[]>,
  ) {}
  nextId(): NotificationId {
    return NotificationId.of('n')
  }
  async findById(): Promise<Notification | null> {
    return null
  }
  async save(): Promise<void> {}
  async markAllReadForUser(): Promise<void> {}
  async findUnreadForUserSince(userId: UserId, since: Date): Promise<UnreadNotificationItem[]> {
    this.sinceByUser.set(userId.value, since)
    return this.unreadByUser.get(userId.value) ?? []
  }
  async unreadRecipientIds(): Promise<UserId[]> {
    return this.recipients.map((id) => UserId.of(id))
  }
}

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

class FakeUserDirectory implements UserDirectory {
  constructor(private readonly refs: UserRef[]) {}
  async byIds(ids: string[]): Promise<UserRef[]> {
    return this.refs.filter((r) => ids.includes(r.id))
  }
}

class FakeEmailSender implements EmailSender {
  sent: DigestEmail[] = []
  constructor(private readonly outcome: (email: DigestEmail) => Result<void> = () => ok(undefined)) {}
  async sendDigest(email: DigestEmail): Promise<Result<void>> {
    this.sent.push(email)
    return this.outcome(email)
  }
}

const itemsOf = (...titles: string[]): UnreadNotificationItem[] => titles.map((title) => ({ title, body: null }))

describe('RunDigestService', () => {
  it('returns zero and sends nothing when no user has unread notifications', async () => {
    const notifs = new FakeNotificationRepo([], new Map())
    const prefs = new FakePreferencesRepo()
    const users = new FakeUserDirectory([])
    const email = new FakeEmailSender()
    const svc = new RunDigestService(prefs, notifs, users, email, clock)

    const res = await svc.execute()

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value).toEqual({ sent: 0, skipped: 0 })
    expect(email.sent).toHaveLength(0)
  })

  it('sends a digest to a first-run user and advances the idempotency stamp', async () => {
    const notifs = new FakeNotificationRepo(
      ['user-1'],
      new Map([['user-1', itemsOf('A', 'B', 'C')]]),
    )
    const prefs = new FakePreferencesRepo() // no row -> default-enabled, first run
    const users = new FakeUserDirectory([{ id: 'user-1', name: 'Alice', email: 'a@t.io' }])
    const email = new FakeEmailSender()
    const svc = new RunDigestService(prefs, notifs, users, email, clock)

    const res = await svc.execute()

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value).toEqual({ sent: 1, skipped: 0 })

    // Email addressed with the user's identity and the unread count.
    expect(email.sent).toHaveLength(1)
    expect(email.sent[0]).toMatchObject({ userId: 'user-1', name: 'Alice', count: 3 })
    expect(email.sent[0].items).toHaveLength(3)

    // First run: window bound is NOW - 24h (no prior stamp).
    const firstRunSince = new Date(NOW.getTime() - NotificationPreferences.FIRST_RUN_WINDOW_MS)
    expect(notifs.sinceByUser.get('user-1')).toEqual(firstRunSince)

    // Stamp advanced to NOW so a retry/overlap will not re-send these items.
    expect(prefs.saved).toHaveLength(1)
    expect(prefs.saved[0].lastDigestSentAt).toEqual(NOW)
  })

  it('uses the prior stamp as the unread window bound for a returning user', async () => {
    const lastSent = new Date('2023-12-31T12:00:00.000Z')
    const existing = NotificationPreferences.rehydrate(UserId.of('user-1'), true, lastSent, lastSent)
    const notifs = new FakeNotificationRepo(['user-1'], new Map([['user-1', itemsOf('A')]]))
    const prefs = new FakePreferencesRepo()
    prefs.seed('user-1', existing)
    const users = new FakeUserDirectory([{ id: 'user-1', name: 'Alice', email: 'a@t.io' }])
    const email = new FakeEmailSender()
    const svc = new RunDigestService(prefs, notifs, users, email, clock)

    const res = await svc.execute()

    expect(res.ok).toBe(true)
    expect(notifs.sinceByUser.get('user-1')).toEqual(lastSent)
    expect(prefs.saved[0].lastDigestSentAt).toEqual(NOW)
  })

  it('skips a recipient absent from the user directory', async () => {
    const notifs = new FakeNotificationRepo(['ghost'], new Map([['ghost', itemsOf('A')]]))
    const prefs = new FakePreferencesRepo()
    const users = new FakeUserDirectory([]) // not resolved
    const email = new FakeEmailSender()
    const svc = new RunDigestService(prefs, notifs, users, email, clock)

    const res = await svc.execute()

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value).toEqual({ sent: 0, skipped: 1 })
    expect(email.sent).toHaveLength(0)
  })

  it('skips a user who disabled the digest', async () => {
    const disabled = NotificationPreferences.rehydrate(UserId.of('user-1'), false, null, NOW)
    const notifs = new FakeNotificationRepo(['user-1'], new Map([['user-1', itemsOf('A')]]))
    const prefs = new FakePreferencesRepo()
    prefs.seed('user-1', disabled)
    const users = new FakeUserDirectory([{ id: 'user-1', name: 'Alice', email: 'a@t.io' }])
    const email = new FakeEmailSender()
    const svc = new RunDigestService(prefs, notifs, users, email, clock)

    const res = await svc.execute()

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value).toEqual({ sent: 0, skipped: 1 })
    expect(email.sent).toHaveLength(0)
    expect(prefs.saved).toHaveLength(0)
  })

  it('skips a user whose unread window is empty without sending', async () => {
    const notifs = new FakeNotificationRepo(['user-1'], new Map([['user-1', []]]))
    const prefs = new FakePreferencesRepo()
    const users = new FakeUserDirectory([{ id: 'user-1', name: 'Alice', email: 'a@t.io' }])
    const email = new FakeEmailSender()
    const svc = new RunDigestService(prefs, notifs, users, email, clock)

    const res = await svc.execute()

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value).toEqual({ sent: 0, skipped: 1 })
    expect(email.sent).toHaveLength(0)
  })

  it('leaves the stamp unadvanced and does not count a user whose email send fails', async () => {
    const notifs = new FakeNotificationRepo(['user-1'], new Map([['user-1', itemsOf('A')]]))
    const prefs = new FakePreferencesRepo()
    const users = new FakeUserDirectory([{ id: 'user-1', name: 'Alice', email: 'a@t.io' }])
    const email = new FakeEmailSender(() => fail('smtp down'))
    const svc = new RunDigestService(prefs, notifs, users, email, clock)

    const res = await svc.execute()

    expect(res.ok).toBe(true)
    if (!res.ok) return
    // Not counted as sent and not counted as skipped (will be retried next run).
    expect(res.value).toEqual({ sent: 0, skipped: 0 })
    expect(email.sent).toHaveLength(1)
    expect(prefs.saved).toHaveLength(0)
  })

  it('isolates a per-user fault so other users in the same run still send', async () => {
    const notifs = new FakeNotificationRepo(
      ['boom', 'user-2'],
      new Map([
        ['boom', itemsOf('X')],
        ['user-2', itemsOf('Y', 'Z')],
      ]),
    )
    const prefs = new FakePreferencesRepo()
    const users = new FakeUserDirectory([
      { id: 'boom', name: 'Bob', email: 'b@t.io' },
      { id: 'user-2', name: 'Carol', email: 'c@t.io' },
    ])
    // First send throws (transient fault); second succeeds.
    let calls = 0
    const email = new FakeEmailSender(() => {
      calls++
      if (calls === 1) throw new Error('transient')
      return ok(undefined)
    })
    const svc = new RunDigestService(prefs, notifs, users, email, clock)

    const res = await svc.execute()

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value).toEqual({ sent: 1, skipped: 0 })
    expect(prefs.saved).toHaveLength(1)
    expect(prefs.saved[0].id.value).toBe('user-2')
  })
})
