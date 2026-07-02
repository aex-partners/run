import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'

import { DrizzleEmailRepository } from '@/contexts/email/adapters/out/persistence/DrizzleEmailRepository'
import { DrizzleEmailAccountRepository } from '@/contexts/email/adapters/out/persistence/DrizzleEmailAccountRepository'
import { DrizzleEmailLabelRepository } from '@/contexts/email/adapters/out/persistence/DrizzleEmailLabelRepository'
import { DrizzleMailMemberRepository } from '@/contexts/email/adapters/out/persistence/DrizzleMailMemberRepository'
import { DrizzleGetEmail } from '@/contexts/email/adapters/out/persistence/DrizzleGetEmail'
import { DrizzleListEmails } from '@/contexts/email/adapters/out/persistence/DrizzleListEmails'
import { DrizzleFolderCounts } from '@/contexts/email/adapters/out/persistence/DrizzleFolderCounts'
import { AesCipher } from '@/contexts/email/adapters/out/crypto/AesCipher'

import { Email, ReceiveEmailProps } from '@/contexts/email/domain/Email'
import { EmailAccount, CreateEmailAccountProps } from '@/contexts/email/domain/EmailAccount'
import { EmailLabel } from '@/contexts/email/domain/EmailLabel'
import { MailAccountMember } from '@/contexts/email/domain/MailAccountMember'
import { EmailFolder } from '@/contexts/email/domain/EmailFolder'

// ADAPTER INTEGRATION tests for the email context Drizzle out-adapters, exercised
// against a REAL Postgres (skips when TEST_DATABASE_URL is unset). All suites live
// in this one file so the within-file tests run sequentially and keep the shared
// DB clean. We never touch email_attachments (it FK-references `files`); leaving
// it empty keeps the file race-free against the files int file.
describeIntegration('email persistence (integration)', () => {
  let db: Database
  let now: Date

  beforeAll(async () => {
    db = getTestDb()
    now = new Date('2025-06-01T12:00:00.000Z')
    // Seed FK prerequisites for ownerId / member userId. Disjoint, idempotent —
    // users is NOT truncated by beforeEach, so seeding once is enough but the
    // onConflictDoNothing keeps it safe across re-runs.
    await db
      .insert(schema.users)
      .values([
        { id: 'u-mail-1', name: 'Mail One', email: 'u-mail-1@x.test' },
        { id: 'u-mail-2', name: 'Mail Two', email: 'u-mail-2@x.test' },
        { id: 'u-mail-3', name: 'Mail Three', email: 'u-mail-3@x.test' },
      ])
      .onConflictDoNothing()
  })

  // SCOPED truncate — only this context's tables, never the global resetDb().
  // CASCADE also clears email_attachments (FK to emails); users survive.
  beforeEach(async () => {
    await db.execute(
      sql.raw('TRUNCATE email_accounts, mail_account_members, emails, email_labels RESTART IDENTITY CASCADE'),
    )
  })

  // --- helpers ------------------------------------------------------------

  const accountRepo = () => new DrizzleEmailAccountRepository(db)
  const emailRepo = () => new DrizzleEmailRepository(db)

  async function seedAccount(
    ownerId: string,
    overrides: Partial<CreateEmailAccountProps> = {},
  ): Promise<EmailAccount> {
    const repo = accountRepo()
    const props: CreateEmailAccountProps = {
      displayName: 'My Mailbox',
      emailAddress: 'mailbox@x.test',
      fromName: 'Mailbox',
      smtpHost: 'smtp.x.test',
      smtpPort: 587,
      smtpUser: 'smtp-user',
      smtpPassCipher: 'smtp-secret',
      smtpSecure: true,
      isShared: false,
      ownerId,
      ...overrides,
    }
    const res = EmailAccount.create(repo.nextId(), props, now)
    if (!res.ok) throw new Error(`seedAccount failed: ${res.error}`)
    await repo.save(res.value)
    return res.value
  }

  async function seedEmail(accountId: string, overrides: Partial<ReceiveEmailProps> = {}): Promise<Email> {
    const repo = emailRepo()
    const id = repo.nextId()
    const props: ReceiveEmailProps = {
      accountId,
      externalId: `ext-${id.value}`,
      threadId: null,
      fromName: 'Alice Sender',
      fromEmail: 'alice@x.test',
      to: ['me@x.test'],
      cc: [],
      subject: 'Subject line',
      bodyHtml: '<p>Body</p>',
      bodyText: 'Body',
      folder: 'inbox',
      read: false,
      starred: false,
      hasAttachment: false,
      date: new Date('2025-01-01T10:00:00.000Z'),
      ...overrides,
    }
    const email = Email.receive(id, props, now)
    await repo.save(email)
    return email
  }

  // --- DrizzleEmailAccountRepository --------------------------------------

  describe('DrizzleEmailAccountRepository', () => {
    it('save -> findById round-trips an account', async () => {
      const repo = accountRepo()
      const acct = await seedAccount('u-mail-1', {
        displayName: 'Sales Inbox',
        emailAddress: 'sales@x.test',
        smtpHost: 'smtp.sales.test',
        smtpPort: 465,
        smtpUser: 'sales',
      })

      const found = await repo.findById(acct.id)
      expect(found).not.toBeNull()
      expect(found!.id.value).toBe(acct.id.value)
      expect(found!.displayName).toBe('Sales Inbox')
      expect(found!.emailAddress).toBe('sales@x.test')
      expect(found!.smtpHost).toBe('smtp.sales.test')
      expect(found!.smtpPort).toBe(465)
      expect(found!.smtpUser).toBe('sales')
      expect(found!.smtpSecure).toBe(true)
      expect(found!.ownerId).toBe('u-mail-1')
    })

    it('nextId mints distinct ids', () => {
      const repo = accountRepo()
      expect(repo.nextId().value).not.toBe(repo.nextId().value)
    })

    it('returns null for a missing account', async () => {
      const repo = accountRepo()
      const found = await repo.findById(repo.nextId())
      expect(found).toBeNull()
    })

    it('accountIdsForUser returns owned + member accounts, de-duplicated', async () => {
      const repo = accountRepo()
      const owned = await seedAccount('u-mail-1', { emailAddress: 'owned@x.test' })
      const shared = await seedAccount('u-mail-2', { emailAddress: 'shared@x.test', isShared: true })

      // u-mail-1 is a member of u-mail-2's shared account.
      const memberRepo = new DrizzleMailMemberRepository(db)
      await memberRepo.save(MailAccountMember.create(shared.id.value, 'u-mail-1', true, now))

      const ids = await repo.accountIdsForUser('u-mail-1')
      expect(ids.sort()).toEqual([owned.id.value, shared.id.value].sort())
      // No duplicates even though the user owns one and is a member of the other.
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('delete removes the account row', async () => {
      const repo = accountRepo()
      const acct = await seedAccount('u-mail-1')
      await repo.delete(acct)
      expect(await repo.findById(acct.id)).toBeNull()
    })
  })

  // --- DrizzleEmailRepository ---------------------------------------------

  describe('DrizzleEmailRepository', () => {
    it('save -> findById round-trips an email', async () => {
      const acct = await seedAccount('u-mail-1')
      const repo = emailRepo()
      const email = await seedEmail(acct.id.value, {
        subject: 'Hello world',
        fromEmail: 'bob@x.test',
        to: ['x@x.test', 'y@x.test'],
        cc: ['c@x.test'],
        folder: 'inbox',
        starred: true,
      })

      const found = await repo.findById(email.id)
      expect(found).not.toBeNull()
      expect(found!.subject).toBe('Hello world')
      expect(found!.fromEmail).toBe('bob@x.test')
      expect(found!.to).toEqual(['x@x.test', 'y@x.test'])
      expect(found!.cc).toEqual(['c@x.test'])
      expect(found!.folder).toBe('inbox')
      expect(found!.starred).toBe(true)
      expect(found!.accountId).toBe(acct.id.value)
    })

    it('findInAccounts enforces account scope', async () => {
      const acct = await seedAccount('u-mail-1')
      const email = await seedEmail(acct.id.value)
      const repo = emailRepo()

      expect(await repo.findInAccounts(email.id, [acct.id.value])).not.toBeNull()
      expect(await repo.findInAccounts(email.id, ['some-other-account'])).toBeNull()
      expect(await repo.findInAccounts(email.id, [])).toBeNull()
    })

    it('findManyInAccounts returns only in-scope rows', async () => {
      const acctA = await seedAccount('u-mail-1', { emailAddress: 'a@x.test' })
      const acctB = await seedAccount('u-mail-2', { emailAddress: 'b@x.test' })
      const e1 = await seedEmail(acctA.id.value)
      const e2 = await seedEmail(acctA.id.value)
      const eB = await seedEmail(acctB.id.value)
      const repo = emailRepo()

      const found = await repo.findManyInAccounts([e1.id.value, e2.id.value, eB.id.value], [acctA.id.value])
      expect(found.map((e) => e.id.value).sort()).toEqual([e1.id.value, e2.id.value].sort())
    })

    it('existingExternalIds collects external ids for an account', async () => {
      const acct = await seedAccount('u-mail-1')
      await seedEmail(acct.id.value, { externalId: 'msg-1' })
      await seedEmail(acct.id.value, { externalId: 'msg-2' })
      const repo = emailRepo()

      const ids = await repo.existingExternalIds(acct.id.value)
      expect(ids).toEqual(new Set(['msg-1', 'msg-2']))
    })

    it('saveMany inserts a batch', async () => {
      const acct = await seedAccount('u-mail-1')
      const repo = emailRepo()
      const a = Email.receive(
        repo.nextId(),
        baseReceive(acct.id.value, { externalId: 'batch-a' }),
        now,
      )
      const b = Email.receive(
        repo.nextId(),
        baseReceive(acct.id.value, { externalId: 'batch-b' }),
        now,
      )
      await repo.saveMany([a, b])

      expect(await repo.findById(a.id)).not.toBeNull()
      expect(await repo.findById(b.id)).not.toBeNull()
    })
  })

  // --- DrizzleEmailLabelRepository ----------------------------------------

  describe('DrizzleEmailLabelRepository', () => {
    it('create/save -> findById round-trips a label', async () => {
      const acct = await seedAccount('u-mail-1')
      const repo = new DrizzleEmailLabelRepository(db)
      const res = EmailLabel.create(repo.nextId(), acct.id.value, 'Important', '#ff0000', now)
      if (!res.ok) throw new Error(res.error)
      await repo.save(res.value)

      const found = await repo.findById(res.value.id)
      expect(found).not.toBeNull()
      expect(found!.name).toBe('Important')
      expect(found!.color).toBe('#ff0000')
      expect(found!.accountId).toBe(acct.id.value)
    })

    it('findByNameInAccounts scopes by account set', async () => {
      const acct = await seedAccount('u-mail-1')
      const repo = new DrizzleEmailLabelRepository(db)
      const res = EmailLabel.create(repo.nextId(), acct.id.value, 'Work', '#00ff00', now)
      if (!res.ok) throw new Error(res.error)
      await repo.save(res.value)

      expect(await repo.findByNameInAccounts('Work', [acct.id.value])).not.toBeNull()
      expect(await repo.findByNameInAccounts('Work', ['other'])).toBeNull()
      expect(await repo.findByNameInAccounts('Nope', [acct.id.value])).toBeNull()
    })

    it('delete removes the label row', async () => {
      const acct = await seedAccount('u-mail-1')
      const repo = new DrizzleEmailLabelRepository(db)
      const res = EmailLabel.create(repo.nextId(), acct.id.value, 'Temp', '#123456', now)
      if (!res.ok) throw new Error(res.error)
      await repo.save(res.value)
      await repo.delete(res.value)
      expect(await repo.findById(res.value.id)).toBeNull()
    })
  })

  // --- DrizzleMailMemberRepository ----------------------------------------

  describe('DrizzleMailMemberRepository', () => {
    it('save (add) -> find round-trips a member', async () => {
      const acct = await seedAccount('u-mail-1', { isShared: true })
      const repo = new DrizzleMailMemberRepository(db)
      await repo.save(MailAccountMember.create(acct.id.value, 'u-mail-2', true, now))

      const found = await repo.find(acct.id.value, 'u-mail-2')
      expect(found).not.toBeNull()
      expect(found!.accountId).toBe(acct.id.value)
      expect(found!.userId).toBe('u-mail-2')
      expect(found!.canSend).toBe(true)
    })

    it('save upserts canSend on the composite key (ON CONFLICT)', async () => {
      const acct = await seedAccount('u-mail-1', { isShared: true })
      const repo = new DrizzleMailMemberRepository(db)
      await repo.save(MailAccountMember.create(acct.id.value, 'u-mail-2', true, now))
      await repo.save(MailAccountMember.create(acct.id.value, 'u-mail-2', false, now))

      const found = await repo.find(acct.id.value, 'u-mail-2')
      expect(found!.canSend).toBe(false)
      // Still a single row (upsert, not a second insert).
      const rows = await db
        .select()
        .from(schema.mailAccountMembers)
        .where(eq(schema.mailAccountMembers.accountId, acct.id.value))
      expect(rows.length).toBe(1)
    })

    it('delete removes the membership', async () => {
      const acct = await seedAccount('u-mail-1', { isShared: true })
      const repo = new DrizzleMailMemberRepository(db)
      const member = MailAccountMember.create(acct.id.value, 'u-mail-2', true, now)
      await repo.save(member)
      await repo.delete(member)
      expect(await repo.find(acct.id.value, 'u-mail-2')).toBeNull()
    })
  })

  // --- DrizzleGetEmail (read-marks-read side effect) ----------------------

  describe('DrizzleGetEmail', () => {
    it('marks an unread email read as a side effect of the first read', async () => {
      const acct = await seedAccount('u-mail-1')
      const email = await seedEmail(acct.id.value, { read: false })

      // Precondition: stored unread.
      const [before] = await db.select({ read: schema.emails.read }).from(schema.emails).where(eq(schema.emails.id, email.id.value))
      expect(before.read).toBe(0)

      const getEmail = new DrizzleGetEmail(db)
      const detail = await getEmail.execute({ userId: 'u-mail-1', id: email.id.value })
      expect(detail).not.toBeNull()
      expect(detail!.read).toBe(true)
      expect(detail!.attachments).toEqual([])

      // The read side-effect persisted: the raw row's `read` flag is now 1.
      const [after] = await db.select({ read: schema.emails.read }).from(schema.emails).where(eq(schema.emails.id, email.id.value))
      expect(after.read).toBe(1)
    })

    it('returns null when the email is not in the caller accessible accounts', async () => {
      const acct = await seedAccount('u-mail-1')
      const email = await seedEmail(acct.id.value)
      const getEmail = new DrizzleGetEmail(db)
      // u-mail-3 owns nothing and is a member of nothing.
      expect(await getEmail.execute({ userId: 'u-mail-3', id: email.id.value })).toBeNull()
    })
  })

  // --- DrizzleListEmails + DrizzleFolderCounts ----------------------------

  describe('DrizzleListEmails + DrizzleFolderCounts', () => {
    const folders: EmailFolder[] = ['inbox', 'sent', 'drafts', 'spam', 'trash', 'archive']

    async function seedAcrossFolders(accountId: string): Promise<void> {
      // One email per real folder, plus an extra unread inbox + a starred inbox.
      let i = 0
      for (const folder of folders) {
        await seedEmail(accountId, {
          folder,
          externalId: `f-${folder}`,
          subject: `In ${folder}`,
          read: true,
          date: new Date(`2025-01-0${++i}T08:00:00.000Z`),
        })
      }
      // An UNREAD inbox email (so inbox unread count = 1).
      await seedEmail(accountId, {
        folder: 'inbox',
        externalId: 'inbox-unread',
        subject: 'Unread inbox',
        read: false,
        date: new Date('2025-02-01T08:00:00.000Z'),
      })
      // A starred inbox email (read, so it does not bump the unread count).
      await seedEmail(accountId, {
        folder: 'inbox',
        externalId: 'inbox-starred',
        subject: 'Starred inbox',
        read: true,
        starred: true,
        date: new Date('2025-02-02T08:00:00.000Z'),
      })
    }

    it('lists emails filtered by folder, newest first', async () => {
      const acct = await seedAccount('u-mail-1')
      await seedAcrossFolders(acct.id.value)
      const list = new DrizzleListEmails(db)

      const inbox = await list.execute({ userId: 'u-mail-1', folder: 'inbox', limit: 50, offset: 0 })
      // inbox has: "In inbox", "Unread inbox", "Starred inbox" = 3 rows.
      expect(inbox.length).toBe(3)
      expect(inbox.every((e) => e.folder === 'inbox')).toBe(true)
      // Ordered by date desc -> the Feb 2 starred one is first.
      expect(inbox[0].subject).toBe('Starred inbox')

      const sent = await list.execute({ userId: 'u-mail-1', folder: 'sent', limit: 50, offset: 0 })
      expect(sent.map((e) => e.subject)).toEqual(['In sent'])

      const trash = await list.execute({ userId: 'u-mail-1', folder: 'trash', limit: 50, offset: 0 })
      expect(trash.map((e) => e.subject)).toEqual(['In trash'])
    })

    it("the 'starred' view lists starred emails regardless of folder", async () => {
      const acct = await seedAccount('u-mail-1')
      await seedAcrossFolders(acct.id.value)
      const list = new DrizzleListEmails(db)

      const starred = await list.execute({ userId: 'u-mail-1', folder: 'starred', limit: 50, offset: 0 })
      expect(starred.length).toBe(1)
      expect(starred[0].subject).toBe('Starred inbox')
      expect(starred[0].starred).toBe(true)
    })

    it('search filters on subject/from/preview (ILIKE)', async () => {
      const acct = await seedAccount('u-mail-1')
      await seedAcrossFolders(acct.id.value)
      const list = new DrizzleListEmails(db)

      const hit = await list.execute({ userId: 'u-mail-1', folder: 'inbox', search: 'Unread', limit: 50, offset: 0 })
      expect(hit.map((e) => e.subject)).toEqual(['Unread inbox'])
    })

    it('returns nothing for a user with no accessible accounts', async () => {
      const acct = await seedAccount('u-mail-1')
      await seedAcrossFolders(acct.id.value)
      const list = new DrizzleListEmails(db)
      expect(await list.execute({ userId: 'u-mail-3', folder: 'inbox', limit: 50, offset: 0 })).toEqual([])
    })

    it('FolderCounts aggregates per folder (inbox = UNREAD only)', async () => {
      const acct = await seedAccount('u-mail-1')
      await seedAcrossFolders(acct.id.value)
      const counts = new DrizzleFolderCounts(db)

      const result = await counts.execute({ userId: 'u-mail-1' })
      expect(result).toEqual({
        inbox: 1, // only the single UNREAD inbox email is counted
        sent: 1,
        drafts: 1,
        spam: 1,
        trash: 1,
        starred: 1,
      })
    })

    it('FolderCounts returns zeros for an inaccessible accountId', async () => {
      const acct = await seedAccount('u-mail-1')
      await seedAcrossFolders(acct.id.value)
      const counts = new DrizzleFolderCounts(db)

      const result = await counts.execute({ userId: 'u-mail-1', accountId: 'not-mine' })
      expect(result).toEqual({ inbox: 0, sent: 0, drafts: 0, spam: 0, trash: 0, starred: 0 })
    })
  })

  // --- AesCipher boundary --------------------------------------------------

  describe('AesCipher', () => {
    it('encrypt -> decrypt round-trips with a configured key', () => {
      const cipher = new AesCipher('this-is-a-test-encryption-secret-key')
      const plaintext = 'hunter2-super-secret'
      const enc = cipher.encrypt(plaintext)
      expect(enc).not.toBe(plaintext)
      expect(enc.startsWith('enc:')).toBe(true)
      expect(cipher.decrypt(enc)).toBe(plaintext)
    })

    it('produces distinct ciphertexts for the same plaintext (random salt/iv)', () => {
      const cipher = new AesCipher('this-is-a-test-encryption-secret-key')
      const a = cipher.encrypt('same')
      const b = cipher.encrypt('same')
      expect(a).not.toBe(b)
      expect(cipher.decrypt(a)).toBe('same')
      expect(cipher.decrypt(b)).toBe('same')
    })

    it('accepts a 64-hex key directly', () => {
      const hexKey = 'a'.repeat(64)
      const cipher = new AesCipher(hexKey)
      const enc = cipher.encrypt('payload')
      expect(enc.startsWith('enc:')).toBe(true)
      expect(cipher.decrypt(enc)).toBe('payload')
    })

    it('is a no-op when no key is configured (plaintext storage)', () => {
      const cipher = new AesCipher()
      expect(cipher.encrypt('plain')).toBe('plain')
      expect(cipher.decrypt('plain')).toBe('plain')
      expect(cipher.decrypt(null)).toBeNull()
    })

    it('passes through values not tagged with the enc: prefix', () => {
      const cipher = new AesCipher('this-is-a-test-encryption-secret-key')
      expect(cipher.decrypt('legacy-plaintext')).toBe('legacy-plaintext')
    })
  })

  // --- End-to-end account credential boundary -----------------------------

  describe('EmailAccount credential boundary (AesCipher + repository)', () => {
    it('stores smtp/imap passwords ENCRYPTED on disk and returns them decryptable via the repo', async () => {
      const cipher = new AesCipher('this-is-a-test-encryption-secret-key')
      const smtpPlain = 'smtp-plaintext-pw'
      const imapPlain = 'imap-plaintext-pw'

      // The application boundary: encrypt the plaintext BEFORE it reaches the
      // aggregate, which only ever carries ciphertext.
      const repo = accountRepo()
      const res = EmailAccount.create(
        repo.nextId(),
        {
          displayName: 'Secured',
          emailAddress: 'secure@x.test',
          smtpHost: 'smtp.secure.test',
          smtpPort: 587,
          smtpUser: 'secure-user',
          smtpPassCipher: cipher.encrypt(smtpPlain),
          smtpSecure: true,
          imapHost: 'imap.secure.test',
          imapPort: 993,
          imapUser: 'secure-user',
          imapPassCipher: cipher.encrypt(imapPlain),
          imapSecure: true,
          isShared: false,
          ownerId: 'u-mail-1',
        },
        now,
      )
      if (!res.ok) throw new Error(res.error)
      await repo.save(res.value)

      // Raw row: the persisted columns hold ciphertext, never the plaintext.
      const [raw] = await db
        .select({ smtpPass: schema.emailAccounts.smtpPass, imapPass: schema.emailAccounts.imapPass })
        .from(schema.emailAccounts)
        .where(eq(schema.emailAccounts.id, res.value.id.value))
      expect(raw.smtpPass).not.toBe(smtpPlain)
      expect(raw.imapPass).not.toBe(imapPlain)
      expect(raw.smtpPass.startsWith('enc:')).toBe(true)
      expect(raw.imapPass!.startsWith('enc:')).toBe(true)

      // Loaded via the repo: still ciphertext on the aggregate, but the cipher
      // boundary decrypts it back to the original plaintext.
      const loaded = await repo.findById(res.value.id)
      expect(loaded).not.toBeNull()
      expect(loaded!.smtpPassCipher.startsWith('enc:')).toBe(true)
      expect(loaded!.imapPassCipher!.startsWith('enc:')).toBe(true)
      expect(cipher.decrypt(loaded!.smtpPassCipher)).toBe(smtpPlain)
      expect(cipher.decrypt(loaded!.imapPassCipher)).toBe(imapPlain)
    })
  })

  // Shared receive-prop builder for cases that bypass the seedEmail helper.
  function baseReceive(accountId: string, overrides: Partial<ReceiveEmailProps> = {}): ReceiveEmailProps {
    return {
      accountId,
      externalId: 'ext',
      threadId: null,
      fromName: 'Sender',
      fromEmail: 'sender@x.test',
      to: ['me@x.test'],
      cc: [],
      subject: 'Subject',
      bodyHtml: '<p>Body</p>',
      bodyText: 'Body',
      folder: 'inbox',
      read: false,
      starred: false,
      hasAttachment: false,
      date: new Date('2025-01-01T10:00:00.000Z'),
      ...overrides,
    }
  }
})
