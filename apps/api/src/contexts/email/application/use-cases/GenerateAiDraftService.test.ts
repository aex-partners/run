import { describe, it, expect } from 'vitest'
import { GenerateAiDraftService } from '@/contexts/email/application/use-cases/GenerateAiDraftService'
import { EmailRepository } from '@/contexts/email/application/ports/out/EmailRepository'
import { EmailAccountRepository } from '@/contexts/email/application/ports/out/EmailAccountRepository'
import { AiDrafter, AiDraftInput } from '@/contexts/email/application/ports/out/AiDrafter'
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
    fromName: 'Alice',
    fromEmail: 'alice@example.com',
    to: ['me@example.com'],
    cc: [],
    subject: 'Quarterly report',
    preview: 'preview',
    bodyHtml: '<p>Please review the numbers.</p>',
    bodyText: 'Please review the numbers.',
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

class FakeAiDrafter implements AiDrafter {
  readonly draftInputs: AiDraftInput[] = []
  constructor(
    private enabled: boolean,
    private canned = 'Thanks for your message, I will review and reply shortly.',
  ) {}
  async isEnabled(): Promise<boolean> {
    return this.enabled
  }
  async summarize(): Promise<string> {
    return 'unused'
  }
  async draft(input: AiDraftInput): Promise<string> {
    this.draftInputs.push(input)
    return this.canned
  }
}

class RecordingPublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.events.push(...events)
  }
}

const setup = (enabled: boolean, byUser: Record<string, string[]> = { user: ['acc-1'] }) => {
  const accounts = new FakeAccountRepo(byUser)
  const emails = new FakeEmailRepo()
  const ai = new FakeAiDrafter(enabled)
  const events = new RecordingPublisher()
  const service = new GenerateAiDraftService(accounts, emails, ai, events, fixedClock(NOW))
  return { accounts, emails, ai, events, service }
}

describe('GenerateAiDraftService', () => {
  it('drafts a reply for an accessible email, stores it and publishes EmailDrafted', async () => {
    const { emails, ai, events, service } = setup(true)
    emails.seed(seedEmail({ id: 'e1', accountId: 'acc-1' }))

    const res = await service.execute({ actorId: 'user', id: 'e1', prompt: 'be concise' })

    expect(res.ok).toBe(true)
    if (res.ok) expect(res.value.draft).toBe('Thanks for your message, I will review and reply shortly.')
    // The AiDrafter received the email fields and the steering prompt.
    expect(ai.draftInputs[0]).toEqual({
      subject: 'Quarterly report',
      from: 'Alice',
      body: 'Please review the numbers.',
      prompt: 'be concise',
    })
    expect(emails.store.get('e1')!.aiDraft).toBe('Thanks for your message, I will review and reply shortly.')
    expect(emails.saved).toHaveLength(1)
    expect(events.events.map((e) => e.name)).toEqual(['email.EmailDrafted'])
  })

  it('fails when AI for email is disabled, without touching the repository', async () => {
    const { emails, events, service } = setup(false)
    emails.seed(seedEmail({ id: 'e1', accountId: 'acc-1' }))

    const res = await service.execute({ actorId: 'user', id: 'e1' })

    expect(res.ok).toBe(false)
    expect(emails.saved).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })

  it('fails when the email is not accessible to the actor', async () => {
    const { emails, events, service } = setup(true, { user: ['acc-1'] })
    emails.seed(seedEmail({ id: 'e1', accountId: 'acc-9' }))

    const res = await service.execute({ actorId: 'user', id: 'e1' })

    expect(res.ok).toBe(false)
    expect(events.events).toHaveLength(0)
  })
})
