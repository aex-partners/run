import { Result } from '@/shared/kernel/Result'

// Driving ports behind the AEX emails.mailAccounts CRUD. Passwords arrive as
// plaintext; the use cases encrypt them through the Cipher out-port before they
// reach the aggregate.

export interface CreateAccountCommand {
  ownerId: string
  displayName: string
  emailAddress: string
  fromName?: string
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPass: string
  smtpSecure: boolean
  imapHost?: string
  imapPort: number
  imapUser?: string
  imapPass?: string
  imapSecure: boolean
  isShared: boolean
}

export interface CreateAccount {
  execute(cmd: CreateAccountCommand): Promise<Result<{ id: string }>>
}

export interface UpdateAccountCommand {
  actorId: string
  id: string
  displayName?: string
  emailAddress?: string
  fromName?: string
  smtpHost?: string
  smtpPort?: number
  smtpUser?: string
  smtpPass?: string
  smtpSecure?: boolean
  isShared?: boolean
}

export interface UpdateAccount {
  execute(cmd: UpdateAccountCommand): Promise<Result<{ success: true }>>
}

export interface DeleteAccountCommand {
  actorId: string
  id: string
}

export interface DeleteAccount {
  execute(cmd: DeleteAccountCommand): Promise<Result<{ success: true }>>
}
