import { describe, it, expect } from 'vitest'
import { SnoozeEmailService } from '@/contexts/email/application/use-cases/SnoozeEmailService'
import { EmailRepository } from '@/contexts/email/application/ports/out/EmailRepository'
import { EmailAccountRepository } from '@/contexts/email/application/ports/out/EmailAccountRepository'
import { Scheduler, SnoozeWakeRequest } from '@/contexts/email/application/ports/out/Scheduler'
import { Email, EmailSnapshot } from '@/contexts/email/domain/Email'
import { EmailAccount } from '@/contexts/email/domain/EmailAccount'
import { EmailId, EmailAccountId } from '@/contexts/email/domain/ids'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2026-01-01T00:00:00Z')
const fixedClock = (now: Date): Clock => ({ now: () => now })

const seedEmail = (over: Partial<EmailSnapshot> & { id: string }): Email => {
  const { id, ...rest } = over
  const email = Email.rehydrate(EmailId.of(id), {
    accountId: 'acc-1',
    externalId: `ext-${id}`,
    threadId: null,
    fromName: 'Sender',
    fromEmail: 'sender@example.com',
    to: ['me@example.com'],
    cc: [],
    subject: 'Hello',
    preview: 'Hello there',
    bodyHtml: '<p>Hi</p>',
    bodyText: 'Hi',
    folder: 'inbox',
    read: false,
    starred: false,
    hasAttachment: false,
    labels: [],
    aiSummary: null,
    aiDraft: null,
    date: NOW,
    createdAt: NOW,
    ...rest,
  })
  email.pullEvents()
  return email
}

class FakeEmailRepo implements EmailRepository {
  private seq = 0
  readonly store = new Map<string, Email>()
  readonly saved: Email[] = []
  seed(email: Email) {
    this.store.set(email.id.value, email)
  }
  nextId(): EmailId {
    this.seq += 1
    return EmailId.of(`new-${this.seq}`)
  }
  async findById(id: EmailId): Promise<Email | null> {
    return this.store.get(id.value) ?? null
  }
  async findInAccounts(id: EmailId, accountIds: readonly string[]): Promise<Email | null> {
    const e = this.store.get(id.value)
    return e && accountIds.includes(e.accountId) ? e : null
  }
  async findManyInAccounts(ids: readonly string[], accountIds: readonly string[]): Promise<Email[]> {
    return [...this.store.values()].filter((e) => ids.includes(e.id.value) && accountIds.includes(e.accountId))
  }
  async existingExternalIds(): Promise<Set<string>> {
    return new Set()
  }
  async save(email: Email): Promise<void> {
    this.saved.push(email)
    this.store.set(email.id.value, email)
  }
  async saveMany(): Promise<void> {}
}

class FakeAccountRepo implements EmailAccountRepository {
  constructor(private byUser: Record<string, string[]>) {}
  nextId(): EmailAccountId {
    return EmailAccountId.of('a-new')
  }
  async findById(): Promise<EmailAccount | null> {
    return null
  }
  async accountIdsForUser(userId: string): Promise<string[]> {
    return [...(this.byUser[userId] ?? [])]
  }
  async save(): Promise<void> {}
  async delete(): Promise<void> {}
}

class FakeScheduler implements Scheduler {
  readonly scheduled: SnoozeWakeRequest[] = []
  async scheduleSnoozeWake(request: SnoozeWakeRequest): Promise<void> {
    this.scheduled.push(request)
  }
}

class RecordingPublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.events.push(...events)
  }
}

const setup = (byUser: Record<string, string[]>) => {
  const accounts = new FakeAccountRepo(byUser)
  const emails = new FakeEmailRepo()
  const scheduler = new FakeScheduler()
  const events = new RecordingPublisher()
  const service = new SnoozeEmailService(accounts, emails, scheduler, events, fixedClock(NOW))
  return { accounts, emails, scheduler, events, service }
}

describe('SnoozeEmailService', () => {
  it('snoozes an accessible email: marks read, schedules the wake and publishes EmailSnoozed', async () => {
    const { emails, scheduler, events, service } = setup({ user: ['acc-1'] })
    emails.seed(seedEmail({ id: 'e1', accountId: 'acc-1', read: false }))

    const res = await service.execute({ actorId: 'user', id: 'e1', until: '1h' })

    expect(res.ok).toBe(true)
    const wakeAt = new Date(NOW.getTime() + 60 * 60 * 1000)
    if (res.ok) expect(res.value.snoozedUntil).toBe(wakeAt.toISOString())
    // Snooze marks the email read and stashes the wake marker.
    expect(emails.store.get('e1')!.read).toBe(true)
    expect(emails.saved).toHaveLength(1)
    expect(scheduler.scheduled).toEqual([{ emailId: 'e1', wakeAt }])
    expect(events.events.map((e) => e.name)).toEqual(['email.EmailSnoozed'])
  })

  it('fails on an invalid snooze option, scheduling and saving nothing', async () => {
    const { emails, scheduler, events, service } = setup({ user: ['acc-1'] })
    emails.seed(seedEmail({ id: 'e1', accountId: 'acc-1' }))

    const res = await service.execute({ actorId: 'user', id: 'e1', until: 'whenever' })

    expect(res.ok).toBe(false)
    expect(emails.saved).toHaveLength(0)
    expect(scheduler.scheduled).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })

  it('fails when the email is not accessible to the actor', async () => {
    const { emails, scheduler, service } = setup({ user: ['acc-1'] })
    emails.seed(seedEmail({ id: 'e1', accountId: 'acc-9' }))

    const res = await service.execute({ actorId: 'user', id: 'e1', until: '1h' })

    expect(res.ok).toBe(false)
    expect(scheduler.scheduled).toHaveLength(0)
  })
})
