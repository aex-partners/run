import { describe, it, expect } from 'vitest'
import { ToggleStarService } from '@/contexts/email/application/use-cases/ToggleStarService'
import { EmailRepository } from '@/contexts/email/application/ports/out/EmailRepository'
import { EmailAccountRepository } from '@/contexts/email/application/ports/out/EmailAccountRepository'
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

class RecordingPublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.events.push(...events)
  }
}

const setup = (byUser: Record<string, string[]>) => {
  const accounts = new FakeAccountRepo(byUser)
  const emails = new FakeEmailRepo()
  const events = new RecordingPublisher()
  const service = new ToggleStarService(accounts, emails, events, fixedClock(NOW))
  return { accounts, emails, events, service }
}

describe('ToggleStarService', () => {
  it('stars an unstarred accessible email, saves it and publishes EmailStarred(true)', async () => {
    const { emails, events, service } = setup({ user: ['acc-1'] })
    emails.seed(seedEmail({ id: 'e1', accountId: 'acc-1', starred: false }))

    const res = await service.execute({ actorId: 'user', id: 'e1' })

    expect(res.ok).toBe(true)
    if (res.ok) expect(res.value.starred).toBe(true)
    expect(emails.store.get('e1')!.starred).toBe(true)
    expect(emails.saved).toHaveLength(1)
    const ev = events.events[0] as { name: string; starred: boolean }
    expect(ev.name).toBe('email.EmailStarred')
    expect(ev.starred).toBe(true)
  })

  it('unstars an already-starred email', async () => {
    const { emails, service } = setup({ user: ['acc-1'] })
    emails.seed(seedEmail({ id: 'e1', accountId: 'acc-1', starred: true }))

    const res = await service.execute({ actorId: 'user', id: 'e1' })

    expect(res.ok).toBe(true)
    if (res.ok) expect(res.value.starred).toBe(false)
    expect(emails.store.get('e1')!.starred).toBe(false)
  })

  it('fails when the email is not in any of the actor accounts (not found / anti-IDOR)', async () => {
    const { emails, events, service } = setup({ user: ['acc-1'] })
    emails.seed(seedEmail({ id: 'e1', accountId: 'acc-9', starred: false }))

    const res = await service.execute({ actorId: 'user', id: 'e1' })

    expect(res.ok).toBe(false)
    expect(emails.saved).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })

  it('fails when the email does not exist at all', async () => {
    const { events, service } = setup({ user: ['acc-1'] })

    const res = await service.execute({ actorId: 'user', id: 'missing' })

    expect(res.ok).toBe(false)
    expect(events.events).toHaveLength(0)
  })
})
