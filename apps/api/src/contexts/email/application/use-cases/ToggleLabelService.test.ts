import { describe, it, expect } from 'vitest'
import { ToggleLabelService } from '@/contexts/email/application/use-cases/ToggleLabelService'
import { EmailAccountRepository } from '@/contexts/email/application/ports/out/EmailAccountRepository'
import { EmailRepository } from '@/contexts/email/application/ports/out/EmailRepository'
import { EmailLabelRepository } from '@/contexts/email/application/ports/out/EmailLabelRepository'
import { EmailAccount } from '@/contexts/email/domain/EmailAccount'
import { Email } from '@/contexts/email/domain/Email'
import { EmailLabel } from '@/contexts/email/domain/EmailLabel'
import { EmailId, EmailAccountId, EmailLabelId } from '@/contexts/email/domain/ids'
import { Label, DEFAULT_LABEL_COLOR } from '@/contexts/email/domain/Label'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2026-01-01T00:00:00Z')
const fixedClock = (now: Date): Clock => ({ now: () => now })

class FakeAccountRepo implements EmailAccountRepository {
  constructor(private readonly idsByUser: Record<string, string[]> = {}) {}
  nextId(): EmailAccountId {
    return EmailAccountId.of('acc-x')
  }
  async findById(): Promise<EmailAccount | null> {
    return null
  }
  async accountIdsForUser(userId: string): Promise<string[]> {
    return [...(this.idsByUser[userId] ?? [])]
  }
  async save(): Promise<void> {}
  async delete(): Promise<void> {}
}

class FakeEmailRepo implements EmailRepository {
  readonly store = new Map<string, Email>()
  readonly saved: Email[] = []
  nextId(): EmailId {
    return EmailId.of('e-x')
  }
  async findById(id: EmailId): Promise<Email | null> {
    return this.store.get(id.value) ?? null
  }
  async findInAccounts(id: EmailId, accountIds: readonly string[]): Promise<Email | null> {
    const e = this.store.get(id.value)
    return e && accountIds.includes(e.accountId) ? e : null
  }
  async findManyInAccounts(): Promise<Email[]> {
    return []
  }
  async existingExternalIds(): Promise<Set<string>> {
    return new Set()
  }
  async save(email: Email): Promise<void> {
    this.saved.push(email)
  }
  async saveMany(): Promise<void> {}
}

class FakeLabelRepo implements EmailLabelRepository {
  constructor(private readonly defs: EmailLabel[] = []) {}
  nextId(): EmailLabelId {
    return EmailLabelId.of('lbl-x')
  }
  async findById(): Promise<EmailLabel | null> {
    return null
  }
  async findByNameInAccounts(name: string, accountIds: readonly string[]): Promise<EmailLabel | null> {
    return this.defs.find((d) => d.name === name && accountIds.includes(d.accountId)) ?? null
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

const seedEmail = (repo: FakeEmailRepo, id: string, accountId: string, labels: Label[] = []): Email => {
  const e = Email.rehydrate(EmailId.of(id), {
    accountId,
    externalId: 'ext-1',
    threadId: null,
    fromName: 'A',
    fromEmail: 'a@x.com',
    to: ['me@work.com'],
    cc: [],
    subject: 'Hi',
    preview: 'Hi',
    bodyHtml: '<p>Hi</p>',
    bodyText: 'Hi',
    folder: 'inbox',
    read: false,
    starred: false,
    hasAttachment: false,
    labels,
    aiSummary: null,
    aiDraft: null,
    date: NOW,
    createdAt: NOW,
  })
  repo.store.set(id, e)
  return e
}

describe('ToggleLabelService', () => {
  it('fails when the email is not in the caller’s accounts', async () => {
    const accounts = new FakeAccountRepo({ 'user-1': ['acc-1'] })
    const emails = new FakeEmailRepo()
    seedEmail(emails, 'e1', 'acc-OTHER')
    const labels = new FakeLabelRepo()
    const events = new RecordingPublisher()
    const service = new ToggleLabelService(accounts, emails, labels, events, fixedClock(NOW))

    const res = await service.execute({ actorId: 'user-1', id: 'e1', labelName: 'Urgent' })
    expect(res.ok).toBe(false)
    expect(emails.saved).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })

  it('adds the tag using the colour from the account’s label definition and publishes EmailLabelsChanged', async () => {
    const accounts = new FakeAccountRepo({ 'user-1': ['acc-1'] })
    const emails = new FakeEmailRepo()
    const email = seedEmail(emails, 'e1', 'acc-1')
    const def = EmailLabel.create(EmailLabelId.of('lbl-1'), 'acc-1', 'Urgent', '#ff0000', NOW)
    if (!def.ok) throw new Error(def.error)
    const labels = new FakeLabelRepo([def.value])
    const events = new RecordingPublisher()
    const service = new ToggleLabelService(accounts, emails, labels, events, fixedClock(NOW))

    const res = await service.execute({ actorId: 'user-1', id: 'e1', labelName: 'Urgent' })
    expect(res.ok).toBe(true)
    expect(email.labels).toEqual([{ name: 'Urgent', color: '#ff0000' }])
    expect(res.ok && res.value.labels).toEqual([{ name: 'Urgent', color: '#ff0000' }])
    expect(emails.saved).toContain(email)
    expect(events.events.map((e) => e.name)).toEqual(['email.EmailLabelsChanged'])
  })

  it('defaults to grey when no label definition matches', async () => {
    const accounts = new FakeAccountRepo({ 'user-1': ['acc-1'] })
    const emails = new FakeEmailRepo()
    const email = seedEmail(emails, 'e1', 'acc-1')
    const service = new ToggleLabelService(accounts, emails, new FakeLabelRepo(), new RecordingPublisher(), fixedClock(NOW))

    const res = await service.execute({ actorId: 'user-1', id: 'e1', labelName: 'Misc' })
    expect(res.ok).toBe(true)
    expect(email.labels).toEqual([{ name: 'Misc', color: DEFAULT_LABEL_COLOR }])
  })

  it('removes the tag when it is already present (toggle off)', async () => {
    const accounts = new FakeAccountRepo({ 'user-1': ['acc-1'] })
    const emails = new FakeEmailRepo()
    const email = seedEmail(emails, 'e1', 'acc-1', [{ name: 'Urgent', color: '#ff0000' }])
    const service = new ToggleLabelService(accounts, emails, new FakeLabelRepo(), new RecordingPublisher(), fixedClock(NOW))

    const res = await service.execute({ actorId: 'user-1', id: 'e1', labelName: 'Urgent' })
    expect(res.ok).toBe(true)
    expect(email.labels).toEqual([])
  })
})
