import { ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { CreateAccount, CreateAccountCommand } from '@/contexts/email/application/ports/in/ManageAccount'
import { SyncAccount } from '@/contexts/email/application/ports/in/SyncAccount'
import { EmailAccountRepository } from '@/contexts/email/application/ports/out/EmailAccountRepository'
import { MailMemberRepository } from '@/contexts/email/application/ports/out/MailMemberRepository'
import { Cipher } from '@/contexts/email/application/ports/out/Cipher'
import { EmailAccount } from '@/contexts/email/domain/EmailAccount'
import { MailAccountMember } from '@/contexts/email/domain/MailAccountMember'

// Creates an account (passwords encrypted via the Cipher port), registers the
// owner as a sending member, then kicks off an initial IMAP sync in the
// background when IMAP is configured — mirroring the AEX create handler.
export class CreateAccountService implements CreateAccount {
  constructor(
    private readonly accounts: EmailAccountRepository,
    private readonly members: MailMemberRepository,
    private readonly cipher: Cipher,
    private readonly sync: SyncAccount,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: CreateAccountCommand) {
    const now = this.clock.now()
    const id = this.accounts.nextId()

    const account = EmailAccount.create(
      id,
      {
        ownerId: cmd.ownerId,
        displayName: cmd.displayName,
        emailAddress: cmd.emailAddress,
        fromName: cmd.fromName || null,
        smtpHost: cmd.smtpHost,
        smtpPort: cmd.smtpPort,
        smtpUser: cmd.smtpUser,
        smtpPassCipher: this.cipher.encrypt(cmd.smtpPass),
        smtpSecure: cmd.smtpSecure,
        imapHost: cmd.imapHost || null,
        imapPort: cmd.imapPort,
        imapUser: cmd.imapUser || null,
        imapPassCipher: cmd.imapPass ? this.cipher.encrypt(cmd.imapPass) : null,
        imapSecure: cmd.imapSecure,
        isShared: cmd.isShared,
      },
      now,
    )
    if (!account.ok) return fail(account.error)

    await this.accounts.save(account.value)
    const owner = MailAccountMember.create(id.value, cmd.ownerId, true, now)
    await this.members.save(owner)
    await this.events.publish([...account.value.pullEvents(), ...owner.pullEvents()])

    // Background sync (fire-and-forget) when IMAP is configured, as in AEX.
    if (cmd.imapHost) {
      void this.sync.execute({ accountId: id.value }).catch(() => {})
    }

    return ok({ id: id.value })
  }
}
