import { describe, it, expect } from 'vitest'
import { WakeSnoozedEmailService } from '@/contexts/email/application/use-cases/WakeSnoozedEmailService'
import { EmailRepository } from '@/contexts/email/application/ports/out/EmailRepository'
import { Email, EmailSnapshot } from '@/contexts/email/domain/Email'
import { makeSnoozeLabel } from '@/contexts/email/domain/Label'
import { EmailId } from '@/contexts/email/domain/ids'
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

class RecordingPublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.events.push(...events)
  }
}

const setup = () => {
  const emails = new FakeEmailRepo()
  const events = new RecordingPublisher()
  const service = new WakeSnoozedEmailService(emails, events, fixedClock(NOW))
  return { emails, events, service }
}

describe('WakeSnoozedEmailService', () => {
  it('returns a snoozed email to the inbox, unread, with the marker dropped, and publishes EmailUnsnoozed', async () => {
    const { emails, events, service } = setup()
    emails.seed(
      seedEmail({
        id: 'e1',
        folder: 'archive',
        read: true,
        labels: [{ name: 'Work', color: '#fff' }, makeSnoozeLabel(NOW)],
      }),
    )

    const res = await service.execute({ emailId: 'e1' })

    expect(res.ok).toBe(true)
    if (res.ok) expect(res.value.awakened).toBe(true)
    const e = emails.store.get('e1')!
    expect(e.folder).toBe('inbox')
    expect(e.read).toBe(false)
    // Real labels survive; the internal snooze marker is removed.
    expect(e.labels.map((l) => l.name)).toEqual(['Work'])
    expect(emails.saved).toHaveLength(1)
    expect(events.events.map((ev) => ev.name)).toEqual(['email.EmailUnsnoozed'])
  })

  it('is a no-op when the email no longer exists (idempotent worker call)', async () => {
    const { emails, events, service } = setup()

    const res = await service.execute({ emailId: 'gone' })

    expect(res.ok).toBe(true)
    if (res.ok) expect(res.value.awakened).toBe(false)
    expect(emails.saved).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })
})
