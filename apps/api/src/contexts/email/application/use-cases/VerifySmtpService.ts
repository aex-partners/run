import { ok } from '@/shared/kernel/Result'
import { VerifySmtp, VerifySmtpCommand } from '@/contexts/email/application/ports/in/VerifyConnection'
import { SmtpSender } from '@/contexts/email/application/ports/out/SmtpSender'

// Tests raw SMTP credentials from the account form. Nothing is stored.
export class VerifySmtpService implements VerifySmtp {
  constructor(private readonly sender: SmtpSender) {}

  async execute(cmd: VerifySmtpCommand) {
    const result = await this.sender.verify({
      host: cmd.host,
      port: cmd.port,
      user: cmd.user,
      pass: cmd.pass,
      from: cmd.from,
      fromName: null,
      secure: cmd.secure,
    })
    return ok(result)
  }
}
