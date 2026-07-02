import { ok } from '@/shared/kernel/Result'
import { VerifyImap, VerifyImapCommand } from '@/contexts/email/application/ports/in/VerifyConnection'
import { ImapClient } from '@/contexts/email/application/ports/out/ImapClient'

// Tests raw IMAP credentials from the account form. Nothing is stored.
export class VerifyImapService implements VerifyImap {
  constructor(private readonly imap: ImapClient) {}

  async execute(cmd: VerifyImapCommand) {
    const result = await this.imap.verify({
      host: cmd.host,
      port: cmd.port,
      user: cmd.user,
      pass: cmd.pass,
      secure: cmd.secure,
    })
    return ok(result)
  }
}
