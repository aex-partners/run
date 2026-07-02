import { describe, it, expect } from 'vitest'
import { CreateAccountService } from '@/contexts/email/application/use-cases/CreateAccountService'
import { CreateAccountCommand } from '@/contexts/email/application/ports/in/ManageAccount'
import { SyncAccount, SyncAccountCommand } from '@/contexts/email/application/ports/in/SyncAccount'
import { EmailAccountRepository } from '@/contexts/email/application/ports/out/EmailAccountRepository'
import { MailMemberRepository } from '@/contexts/email/application/ports/out/MailMemberRepository'
import { Cipher } from '@/contexts/email/application/ports/out/Cipher'
import { EmailAccount } from '@/contexts/email/domain/EmailAccount'
import { MailAccountMember } from '@/contexts/email/domain/MailAccountMember'
import { EmailAccountId } from '@/contexts/email/domain/ids'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'
import { ok, Result } from '@/shared/kernel/Result'

const NOW = new Date('2026-01-01T00:00:00Z')
const fixedClock = (now: Date): Clock => ({ now: () => now })

const fakeCipher: Cipher = {
  encrypt: (s) => 'enc:' + s,
  decrypt: (s) => (s === null ? null : s.replace('enc:', '')),
}

class FakeAccountRepo implements EmailAccountRepository {
  private seq = 0
  readonly store = new Map<string, EmailAccount>()
  readonly saved: EmailAccount[] = []
  nextId(): EmailAccountId {
    this.seq += 1
    return EmailAccountId.of(`acc-${this.seq}`)
  }
  async findById(id: EmailAccountId): Promise<EmailAccount | null> {
    return this.store.get(id.value) ?? null
  }
  async accountIdsForUser(): Promise<string[]> {
    return []
  }
  async save(account: EmailAccount): Promise<void> {
    this.saved.push(account)
    this.store.set(account.id.value, account)
  }
  async delete(): Promise<void> {}
}

class FakeMemberRepo implements MailMemberRepository {
  readonly saved: MailAccountMember[] = []
  async find(): Promise<MailAccountMember | null> {
    return null
  }
  async save(member: MailAccountMember): Promise<void> {
    this.saved.push(member)
  }
  async delete(): Promise<void> {}
}

class FakeSync implements SyncAccount {
  readonly calls: SyncAccountCommand[] = []
  async execute(cmd: SyncAccountCommand): Promise<Result<{ success: true; fetched: number; errors: number }>> {
    this.calls.push(cmd)
    return ok({ success: true as const, fetched: 0, errors: 0 })
  }
}

class RecordingPublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.events.push(...events)
  }
}

const baseCmd = (over: Partial<CreateAccountCommand> = {}): CreateAccountCommand => ({
  ownerId: 'owner-1',
  displayName: 'Work',
  emailAddress: 'me@work.com',
  fromName: 'Me',
  smtpHost: 'smtp.work.com',
  smtpPort: 587,
  smtpUser: 'me@work.com',
  smtpPass: 'smtp-secret',
  smtpSecure: true,
  imapHost: 'imap.work.com',
  imapPort: 993,
  imapUser: 'me@work.com',
  imapPass: 'imap-secret',
  imapSecure: true,
  isShared: false,
  ...over,
})

const setup = () => {
  const accounts = new FakeAccountRepo()
  const members = new FakeMemberRepo()
  const sync = new FakeSync()
  const events = new RecordingPublisher()
  const service = new CreateAccountService(accounts, members, fakeCipher, sync, events, fixedClock(NOW))
  return { accounts, members, sync, events, service }
}

describe('CreateAccountService', () => {
  it('creates the account with encrypted secrets, registers the owner as a sending member and publishes both events', async () => {
    const { accounts, members, events, service } = setup()
    const res = await service.execute(baseCmd())
    expect(res.ok).toBe(true)
    expect(res.ok && res.value.id).toBe('acc-1')

    expect(accounts.saved).toHaveLength(1)
    const saved = accounts.saved[0]
    expect(saved.smtpPassCipher).toBe('enc:smtp-secret')
    expect(saved.imapPassCipher).toBe('enc:imap-secret')

    expect(members.saved).toHaveLength(1)
    expect(members.saved[0].userId).toBe('owner-1')
    expect(members.saved[0].accountId).toBe('acc-1')
    expect(members.saved[0].canSend).toBe(true)

    expect(events.events.map((e) => e.name)).toEqual(['email.EmailAccountCreated', 'email.MailMemberAdded'])
  })

  it('kicks off a background sync when IMAP is configured', async () => {
    const { sync, service } = setup()
    await service.execute(baseCmd())
    expect(sync.calls).toEqual([{ accountId: 'acc-1' }])
  })

  it('stores no imap ciphertext and triggers no sync when IMAP is absent', async () => {
    const { accounts, sync, service } = setup()
    const res = await service.execute(baseCmd({ imapHost: undefined, imapUser: undefined, imapPass: undefined }))
    expect(res.ok).toBe(true)
    expect(accounts.saved[0].imapPassCipher).toBeNull()
    expect(sync.calls).toHaveLength(0)
  })

  it('fails the create guard (invalid account) without saving or publishing', async () => {
    const { accounts, members, events, service } = setup()
    const res = await service.execute(baseCmd({ displayName: '   ' }))
    expect(res.ok).toBe(false)
    expect(accounts.saved).toHaveLength(0)
    expect(members.saved).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })
})
