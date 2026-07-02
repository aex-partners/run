import { ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { SyncAccount, SyncAccountCommand } from '@/contexts/email/application/ports/in/SyncAccount'
import { EmailAccountRepository } from '@/contexts/email/application/ports/out/EmailAccountRepository'
import { EmailRepository } from '@/contexts/email/application/ports/out/EmailRepository'
import { ImapClient } from '@/contexts/email/application/ports/out/ImapClient'
import { Cipher } from '@/contexts/email/application/ports/out/Cipher'
import { Email } from '@/contexts/email/domain/Email'
import { EmailAccountId } from '@/contexts/email/domain/ids'
import { reconstructThreadId } from '@/contexts/email/domain/ThreadReconstruction'

// Pulls messages from IMAP and stores the new ones. The adapter only fetches;
// this use case dedupes against stored external ids, applies the pure
// ThreadReconstruction rule, builds Email aggregates and persists them — the
// clean split AEX's sync.ts collapsed into one function.
export class SyncAccountService implements SyncAccount {
  constructor(
    private readonly accounts: EmailAccountRepository,
    private readonly emails: EmailRepository,
    private readonly imap: ImapClient,
    private readonly cipher: Cipher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: SyncAccountCommand) {
    if (cmd.actorId !== undefined) {
      const accountIds = await this.accounts.accountIdsForUser(cmd.actorId)
      if (!accountIds.includes(cmd.accountId)) return fail('Account not found')
    }

    const account = await this.accounts.findById(EmailAccountId.of(cmd.accountId))
    if (!account) return fail(`Account ${cmd.accountId} not found`)

    const imapCipher = account.imapSettingsCipher()
    if (!imapCipher) return fail('IMAP not configured for this account')

    const pass = this.cipher.decrypt(imapCipher.pass) ?? imapCipher.pass
    const { messages, errors } = await this.imap.fetchAll({ ...imapCipher, pass })

    const existing = await this.emails.existingExternalIds(cmd.accountId)
    const now = this.clock.now()
    const fresh: Email[] = []

    for (const msg of messages) {
      if (existing.has(msg.externalId)) continue
      const threadId = reconstructThreadId({
        messageId: msg.externalId,
        inReplyTo: msg.inReplyTo,
        references: msg.references,
      })
      fresh.push(
        Email.receive(
          this.emails.nextId(),
          {
            accountId: cmd.accountId,
            externalId: msg.externalId,
            threadId,
            fromName: msg.fromName,
            fromEmail: msg.fromEmail,
            to: msg.to,
            cc: msg.cc,
            subject: msg.subject,
            bodyHtml: msg.bodyHtml,
            bodyText: msg.bodyText,
            folder: msg.folder,
            read: msg.read,
            starred: msg.starred,
            hasAttachment: msg.hasAttachment,
            date: msg.date,
          },
          now,
        ),
      )
      existing.add(msg.externalId)
    }

    await this.emails.saveMany(fresh)
    account.recordSync(now)
    await this.accounts.save(account)

    return ok({ success: true as const, fetched: fresh.length, errors })
  }
}
