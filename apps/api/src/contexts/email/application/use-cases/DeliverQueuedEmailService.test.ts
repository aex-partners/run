import { describe, it, expect } from 'vitest'
import { DeliverQueuedEmailService } from '@/contexts/email/application/use-cases/DeliverQueuedEmailService'
import { EmailRepository } from '@/contexts/email/application/ports/out/EmailRepository'
import { EmailAccountRepository } from '@/contexts/email/application/ports/out/EmailAccountRepository'
import { SmtpSender, OutgoingEmail, SmtpSendResult } from '@/contexts/email/application/ports/out/SmtpSender'
import { Cipher } from '@/contexts/email/application/ports/out/Cipher'
import { QueuedEmail } from '@/contexts/email/application/ports/out/EmailQueue'
import { Email } from '@/contexts/email/domain/Email'
import { EmailAccount, EmailAccountSnapshot, SmtpSettings } from '@/contexts/email/domain/EmailAccount'
import { EmailId, EmailAccountId } from '@/contexts/email/domain/ids'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2026-01-01T00:00:00Z')
const fixedClock = (now: Date): Clock => ({ now: () => now })

const seedAccount = (id: string, over: Partial<EmailAccountSnapshot> = {}): EmailAccount =>
  EmailAccount.rehydrate(EmailAccountId.of(id), {
    displayName: 'Work',
    emailAddress: 'me@example.com',
    fromName: 'Me',
    smtpHost: 'smtp.example.com',
    smtpPort: 587,
    smtpUser: 'me',
    smtpPassCipher: 'enc:smtp-secret',
    smtpSecure: true,
    imapHost: null,
    imapPort: null,
    imapUser: null,
    imapPassCipher: null,
    imapSecure: true,
    lastSyncAt: null,
    isShared: false,
    ownerId: 'owner',
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  })

class FakeAccountRepo implements EmailAccountRepository {
  readonly store = new Map<string, EmailAccount>()
  seed(a: EmailAccount) {
    this.store.set(a.id.value, a)
  }
  nextId(): EmailAccountId {
    return EmailAccountId.of('a-new')
  }
  async findById(id: EmailAccountId): Promise<EmailAccount | null> {
    return this.store.get(id.value) ?? null
  }
  async accountIdsForUser(): Promise<string[]> {
    return []
  }
  async save(): Promise<void> {}
  async delete(): Promise<void> {}
}

class FakeEmailRepo implements EmailRepository {
  private seq = 0
  readonly saved: Email[] = []
  nextId(): EmailId {
    this.seq += 1
    return EmailId.of(`new-${this.seq}`)
  }
  async findById(): Promise<Email | null> {
    return null
  }
  async findInAccounts(): Promise<Email | null> {
    return null
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

class FakeSmtpSender implements SmtpSender {
  readonly sent: { settings: SmtpSettings; message: OutgoingEmail }[] = []
  constructor(private result: SmtpSendResult = { messageId: 'msg-xyz', accepted: [], rejected: [] }) {}
  async send(settings: SmtpSettings, message: OutgoingEmail): Promise<SmtpSendResult> {
    this.sent.push({ settings, message })
    return this.result
  }
  async verify(): Promise<{ ok: boolean; error?: string }> {
    return { ok: true }
  }
}

const reversibleCipher: Cipher = {
  encrypt: (s) => `enc:${s}`,
  decrypt: (s) => (s === null ? null : s.replace('enc:', '')),
}

class RecordingPublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.events.push(...events)
  }
}

const setup = (account?: EmailAccount) => {
  const accounts = new FakeAccountRepo()
  if (account) accounts.seed(account)
  const emails = new FakeEmailRepo()
  const sender = new FakeSmtpSender()
  const events = new RecordingPublisher()
  const service = new DeliverQueuedEmailService(accounts, emails, sender, reversibleCipher, events, fixedClock(NOW))
  return { accounts, emails, sender, events, service }
}

const job = (over: Partial<QueuedEmail> = {}): QueuedEmail => ({
  accountId: 'acc-1',
  to: ['recipient@x.com'],
  subject: 'Subject',
  bodyHtml: '<p>body</p>',
  ...over,
})

describe('DeliverQueuedEmailService', () => {
  it('sends via SMTP with the decrypted password and persists to Sent by default', async () => {
    const { emails, sender, events, service } = setup(seedAccount('acc-1'))

    const res = await service.execute(job({ to: ['recipient@x.com'], subject: 'Hello', bodyHtml: '<p>hi</p>' }))

    expect(res.ok).toBe(true)
    if (res.ok) expect(res.value.delivered).toBe(true)
    expect(sender.sent).toHaveLength(1)
    expect(sender.sent[0].settings.pass).toBe('smtp-secret')
    expect(sender.sent[0].message.to).toEqual(['recipient@x.com'])
    expect(emails.saved).toHaveLength(1)
    expect(emails.saved[0].folder).toBe('sent')
    expect(emails.saved[0].externalId).toBe('msg-xyz')
    expect(events.events.map((e) => e.name)).toEqual(['email.EmailSent'])
  })

  it('delivers without persisting to Sent when storeSent is false (transactional, fire-and-forget)', async () => {
    const { emails, sender, events, service } = setup(seedAccount('acc-1'))

    const res = await service.execute(job({ storeSent: false }))

    expect(res.ok).toBe(true)
    if (res.ok) expect(res.value.delivered).toBe(true)
    // The mail still went out over SMTP...
    expect(sender.sent).toHaveLength(1)
    // ...but nothing was stored and no EmailSent fact was published.
    expect(emails.saved).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })

  it('skips delivery when the sender account no longer exists', async () => {
    const { sender, emails, service } = setup()

    const res = await service.execute(job({ accountId: 'ghost' }))

    expect(res.ok).toBe(true)
    if (res.ok) expect(res.value.delivered).toBe(false)
    expect(sender.sent).toHaveLength(0)
    expect(emails.saved).toHaveLength(0)
  })
})
