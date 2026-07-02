import { describe, it, expect } from 'vitest'
import { SendEmailService } from '@/contexts/email/application/use-cases/SendEmailService'
import { EmailRepository } from '@/contexts/email/application/ports/out/EmailRepository'
import { EmailAccountRepository } from '@/contexts/email/application/ports/out/EmailAccountRepository'
import { MailMemberRepository } from '@/contexts/email/application/ports/out/MailMemberRepository'
import { SmtpSender, OutgoingEmail, SmtpSendResult } from '@/contexts/email/application/ports/out/SmtpSender'
import { Cipher } from '@/contexts/email/application/ports/out/Cipher'
import { AttachmentStore } from '@/contexts/email/application/ports/out/AttachmentStore'
import { Email } from '@/contexts/email/domain/Email'
import { EmailAccount, EmailAccountSnapshot, SmtpSettings } from '@/contexts/email/domain/EmailAccount'
import { MailAccountMember } from '@/contexts/email/domain/MailAccountMember'
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

class FakeMemberRepo implements MailMemberRepository {
  constructor(private members: MailAccountMember[] = []) {}
  async find(accountId: string, userId: string): Promise<MailAccountMember | null> {
    return this.members.find((m) => m.accountId === accountId && m.userId === userId) ?? null
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
  constructor(private result: SmtpSendResult = { messageId: 'msg-123', accepted: [], rejected: [] }) {}
  async send(settings: SmtpSettings, message: OutgoingEmail): Promise<SmtpSendResult> {
    this.sent.push({ settings, message })
    return this.result
  }
  async verify(): Promise<{ ok: boolean; error?: string }> {
    return { ok: true }
  }
}

class FakeAttachmentStore implements AttachmentStore {
  readonly reads: string[] = []
  async read(relativePath: string): Promise<Uint8Array> {
    this.reads.push(relativePath)
    return new Uint8Array([1, 2, 3])
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

const setup = (opts: { account?: EmailAccount; members?: MailAccountMember[]; sender?: FakeSmtpSender } = {}) => {
  const accounts = new FakeAccountRepo()
  if (opts.account) accounts.seed(opts.account)
  const members = new FakeMemberRepo(opts.members ?? [])
  const emails = new FakeEmailRepo()
  const sender = opts.sender ?? new FakeSmtpSender()
  const attachments = new FakeAttachmentStore()
  const events = new RecordingPublisher()
  const service = new SendEmailService(accounts, members, emails, sender, reversibleCipher, attachments, events, fixedClock(NOW))
  return { accounts, members, emails, sender, attachments, events, service }
}

describe('SendEmailService', () => {
  it('sends via SMTP for the owner, stores the message in Sent and publishes EmailSent', async () => {
    const { emails, sender, events, service } = setup({ account: seedAccount('acc-1') })

    const res = await service.execute({
      actorId: 'owner',
      accountId: 'acc-1',
      to: 'a@x.com, b@x.com',
      cc: 'c@x.com',
      subject: 'Hi there',
      body: '<p>hello</p>',
    })

    expect(res.ok).toBe(true)
    if (res.ok) expect(res.value.id).toBe('new-1')
    // Sent with the DECRYPTED password and parsed recipient lists.
    expect(sender.sent).toHaveLength(1)
    expect(sender.sent[0].settings.pass).toBe('smtp-secret')
    expect(sender.sent[0].message.to).toEqual(['a@x.com', 'b@x.com'])
    expect(sender.sent[0].message.cc).toEqual(['c@x.com'])
    expect(sender.sent[0].message.subject).toBe('Hi there')
    // Persisted to Sent, externalId taken from the SMTP messageId.
    expect(emails.saved).toHaveLength(1)
    expect(emails.saved[0].folder).toBe('sent')
    expect(emails.saved[0].externalId).toBe('msg-123')
    expect(events.events.map((e) => e.name)).toEqual(['email.EmailSent'])
  })

  it('allows a shared-account member that has canSend', async () => {
    const member = MailAccountMember.create('acc-1', 'helper', true, NOW)
    member.pullEvents()
    const { sender, service } = setup({ account: seedAccount('acc-1'), members: [member] })

    const res = await service.execute({ actorId: 'helper', accountId: 'acc-1', to: 'a@x.com', subject: 's', body: 'b' })

    expect(res.ok).toBe(true)
    expect(sender.sent).toHaveLength(1)
  })

  it('denies a non-owner that is not a member with canSend (no send, no save)', async () => {
    const { sender, emails, events, service } = setup({ account: seedAccount('acc-1') })

    const res = await service.execute({ actorId: 'stranger', accountId: 'acc-1', to: 'a@x.com', subject: 's', body: 'b' })

    expect(res.ok).toBe(false)
    expect(sender.sent).toHaveLength(0)
    expect(emails.saved).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })

  it('denies a member whose canSend is false', async () => {
    const member = MailAccountMember.create('acc-1', 'readonly', false, NOW)
    member.pullEvents()
    const { sender, service } = setup({ account: seedAccount('acc-1'), members: [member] })

    const res = await service.execute({ actorId: 'readonly', accountId: 'acc-1', to: 'a@x.com', subject: 's', body: 'b' })

    expect(res.ok).toBe(false)
    expect(sender.sent).toHaveLength(0)
  })

  it('fails when the account does not exist', async () => {
    const { sender, service } = setup({})

    const res = await service.execute({ actorId: 'owner', accountId: 'ghost', to: 'a@x.com', subject: 's', body: 'b' })

    expect(res.ok).toBe(false)
    expect(sender.sent).toHaveLength(0)
  })

  it('rejects a traversal attachment path before reading any bytes or sending', async () => {
    const { sender, attachments, service } = setup({ account: seedAccount('acc-1') })

    const res = await service.execute({
      actorId: 'owner',
      accountId: 'acc-1',
      to: 'a@x.com',
      subject: 's',
      body: 'b',
      attachments: [{ id: 'f1', name: 'evil', path: '../../etc/passwd' }],
    })

    expect(res.ok).toBe(false)
    expect(attachments.reads).toHaveLength(0)
    expect(sender.sent).toHaveLength(0)
  })

  it('reads attachment bytes through the store and forwards them to the sender', async () => {
    const { sender, attachments, service } = setup({ account: seedAccount('acc-1') })

    const res = await service.execute({
      actorId: 'owner',
      accountId: 'acc-1',
      to: 'a@x.com',
      subject: 's',
      body: 'b',
      attachments: [{ id: 'f1', name: 'doc.pdf', path: 'uploads/doc.pdf', mimeType: 'application/pdf' }],
    })

    expect(res.ok).toBe(true)
    expect(attachments.reads).toEqual(['uploads/doc.pdf'])
    const att = sender.sent[0].message.attachments
    expect(att).toHaveLength(1)
    expect(att![0]).toMatchObject({ filename: 'doc.pdf', contentType: 'application/pdf' })
    expect(att![0].content).toEqual(new Uint8Array([1, 2, 3]))
  })
})
