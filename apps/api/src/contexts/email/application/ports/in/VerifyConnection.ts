import { Result } from '@/shared/kernel/Result'

// Driving ports behind emails.mailAccounts.verify / verifyImap. Credentials are
// supplied raw (the user is testing a form), so nothing is encrypted or stored.

export interface VerifySmtpCommand {
  host: string
  port: number
  user: string
  pass: string
  from: string
  secure: boolean
}

export interface VerifySmtp {
  execute(cmd: VerifySmtpCommand): Promise<Result<{ ok: boolean; error?: string }>>
}

export interface VerifyImapCommand {
  host: string
  port: number
  user: string
  pass: string
  secure: boolean
}

export interface VerifyImap {
  execute(cmd: VerifyImapCommand): Promise<Result<{ ok: boolean; error?: string }>>
}
