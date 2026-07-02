import { describe, it, expect } from 'vitest'
import { SyncAccountService } from '@/contexts/email/application/use-cases/SyncAccountService'
import { EmailRepository } from '@/contexts/email/application/ports/out/EmailRepository'
import { EmailAccountRepository } from '@/contexts/email/application/ports/out/EmailAccountRepository'
import { ImapClient, FetchResult, FetchedMessage } from '@/contexts/email/application/ports/out/ImapClient'
import { Cipher } from '@/contexts/email/application/ports/out/Cipher'
import { ImapSettings } from '@/contexts/email/domain/EmailAccount'
import { Email } from '@/contexts/email/domain/Email'
import { EmailAccount, EmailAccountSnapshot } from '@/contexts/email/domain/EmailAccount'
import { EmailId, EmailAccountId } from '@/contexts/email/domain/ids'
import { Clock } from '@/shared/kernel/Clock'

const NOW = new Date('2026-06-01T12:00:00Z')
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
    imapHost: 'imap.example.com',
    imapPort: 993,
    imapUser: 'me',
    imapPassCipher: 'enc:imap-secret',
    imapSecure: true,
    lastSyncAt: null,
    isShared: false,
    ownerId: 'owner',
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  })

const msg = (over: Partial<FetchedMessage> & { externalId: string }): FetchedMessage => ({
  folder: 'inbox',
  fromName: 'Alice',
  fromEmail: 'alice@example.com',
  to: ['me@example.com'],
  cc: [],
  subject: 'Hi',
  bodyHtml: '<p>hi</p>',
  bodyText: 'hi',
  read: false,
  starred: false,
  hasAttachment: false,
  date: NOW,
  inReplyTo: null,
  references: [],
  ...over,
})

class FakeEmailRepo implements EmailRepository {
  private seq = 0
  readonly savedMany: Email[][] = []
  constructor(private existing: Set<string> = new Set()) {}
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
    return new Set(this.existing)
  }
  async save(): Promise<void> {}
  async saveMany(emails: readonly Email[]): Promise<void> {
    this.savedMany.push([...emails])
  }
}

class FakeAccountRepo implements EmailAccountRepository {
  readonly store = new Map<string, EmailAccount>()
  readonly saved: EmailAccount[] = []
  constructor(private byUser: Record<string, string[]> = {}) {}
  seed(a: EmailAccount) {
    this.store.set(a.id.value, a)
  }
  nextId(): EmailAccountId {
    return EmailAccountId.of('a-new')
  }
  async findById(id: EmailAccountId): Promise<EmailAccount | null> {
    return this.store.get(id.value) ?? null
  }
  async accountIdsForUser(userId: string): Promise<string[]> {
    return [...(this.byUser[userId] ?? [])]
  }
  async save(account: EmailAccount): Promise<void> {
    this.saved.push(account)
  }
  async delete(): Promise<void> {}
}

class FakeImapClient implements ImapClient {
  readonly fetched: ImapSettings[] = []
  constructor(private result: FetchResult = { messages: [], errors: 0 }) {}
  async fetchAll(settings: ImapSettings): Promise<FetchResult> {
    this.fetched.push(settings)
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

describe('SyncAccountService', () => {
  it('fetches over IMAP, stores only new messages, records the sync time and persists the account', async () => {
    const accounts = new FakeAccountRepo({ owner: ['acc-1'] })
    accounts.seed(seedAccount('acc-1'))
    const emails = new FakeEmailRepo(new Set(['already-stored']))
    const imap = new FakeImapClient({
      messages: [msg({ externalId: 'already-stored' }), msg({ externalId: 'brand-new', inReplyTo: 'parent-id' })],
      errors: 2,
    })
    const service = new SyncAccountService(accounts, emails, imap, reversibleCipher, fixedClock(NOW))

    const res = await service.execute({ actorId: 'owner', accountId: 'acc-1' })

    expect(res.ok).toBe(true)
    if (res.ok) expect(res.value).toEqual({ success: true, fetched: 1, errors: 2 })
    // IMAP received the decrypted password.
    expect(imap.fetched[0].pass).toBe('imap-secret')
    // Only the new message is persisted; thread id comes from In-Reply-To.
    expect(emails.savedMany).toHaveLength(1)
    expect(emails.savedMany[0]).toHaveLength(1)
    expect(emails.savedMany[0][0].externalId).toBe('brand-new')
    expect(emails.savedMany[0][0].threadId).toBe('parent-id')
    // recordSync updates lastSyncAt and the account is saved.
    expect(accounts.saved).toHaveLength(1)
    expect(accounts.saved[0].lastSyncAt).toEqual(NOW)
  })

  it('dedupes repeated external ids within the same fetch batch', async () => {
    const accounts = new FakeAccountRepo({ owner: ['acc-1'] })
    accounts.seed(seedAccount('acc-1'))
    const emails = new FakeEmailRepo()
    const imap = new FakeImapClient({
      messages: [msg({ externalId: 'dup' }), msg({ externalId: 'dup' }), msg({ externalId: 'other' })],
      errors: 0,
    })
    const service = new SyncAccountService(accounts, emails, imap, reversibleCipher, fixedClock(NOW))

    const res = await service.execute({ actorId: 'owner', accountId: 'acc-1' })

    expect(res.ok).toBe(true)
    if (res.ok) expect(res.value.fetched).toBe(2)
    expect(emails.savedMany[0].map((e) => e.externalId)).toEqual(['dup', 'other'])
  })

  it('rejects an account outside the actor scope without touching IMAP', async () => {
    const accounts = new FakeAccountRepo({ owner: ['acc-1'] })
    accounts.seed(seedAccount('acc-2'))
    const emails = new FakeEmailRepo()
    const imap = new FakeImapClient()
    const service = new SyncAccountService(accounts, emails, imap, reversibleCipher, fixedClock(NOW))

    const res = await service.execute({ actorId: 'owner', accountId: 'acc-2' })

    expect(res.ok).toBe(false)
    expect(imap.fetched).toHaveLength(0)
    expect(accounts.saved).toHaveLength(0)
  })

  it('fails for a trusted (no actorId) call when the account does not exist', async () => {
    const accounts = new FakeAccountRepo()
    const emails = new FakeEmailRepo()
    const imap = new FakeImapClient()
    const service = new SyncAccountService(accounts, emails, imap, reversibleCipher, fixedClock(NOW))

    const res = await service.execute({ accountId: 'ghost' })

    expect(res.ok).toBe(false)
    expect(imap.fetched).toHaveLength(0)
  })

  it('fails when the account has no IMAP configured', async () => {
    const accounts = new FakeAccountRepo()
    accounts.seed(seedAccount('acc-1', { imapHost: null, imapUser: null, imapPassCipher: null }))
    const emails = new FakeEmailRepo()
    const imap = new FakeImapClient()
    const service = new SyncAccountService(accounts, emails, imap, reversibleCipher, fixedClock(NOW))

    const res = await service.execute({ accountId: 'acc-1' })

    expect(res.ok).toBe(false)
    expect(imap.fetched).toHaveLength(0)
  })
})
