import { EmailAccount } from '@/contexts/email/domain/EmailAccount'
import { EmailAccountId } from '@/contexts/email/domain/ids'

// Mirrors the AEX `email_accounts` table. Booleans are 0/1 integers; the smtp/
// imap pass columns hold ciphertext exactly as the aggregate carries it.
export interface EmailAccountRow {
  id: string
  displayName: string
  emailAddress: string
  fromName: string | null
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPass: string
  smtpSecure: number
  imapHost: string | null
  imapPort: number | null
  imapUser: string | null
  imapPass: string | null
  imapSecure: number | null
  lastSyncAt: Date | null
  isShared: number
  ownerId: string
  createdAt: Date
  updatedAt: Date
}

export interface EmailAccountValues {
  id: string
  displayName: string
  emailAddress: string
  fromName: string | null
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPass: string
  smtpSecure: number
  imapHost: string | null
  imapPort: number | null
  imapUser: string | null
  imapPass: string | null
  imapSecure: number
  lastSyncAt: Date | null
  isShared: number
  ownerId: string
  updatedAt: Date
}

export const EmailAccountMapper = {
  toValues(account: EmailAccount): EmailAccountValues {
    return {
      id: account.id.value,
      displayName: account.displayName,
      emailAddress: account.emailAddress,
      fromName: account.fromName,
      smtpHost: account.smtpHost,
      smtpPort: account.smtpPort,
      smtpUser: account.smtpUser,
      smtpPass: account.smtpPassCipher,
      smtpSecure: account.smtpSecure ? 1 : 0,
      imapHost: account.imapHost,
      imapPort: account.imapPort,
      imapUser: account.imapUser,
      imapPass: account.imapPassCipher,
      imapSecure: account.imapSecure ? 1 : 0,
      lastSyncAt: account.lastSyncAt,
      isShared: account.isShared ? 1 : 0,
      ownerId: account.ownerId,
      updatedAt: account.updatedAt,
    }
  },

  toDomain(row: EmailAccountRow): EmailAccount {
    return EmailAccount.rehydrate(EmailAccountId.of(row.id), {
      displayName: row.displayName,
      emailAddress: row.emailAddress,
      fromName: row.fromName,
      smtpHost: row.smtpHost,
      smtpPort: row.smtpPort,
      smtpUser: row.smtpUser,
      smtpPassCipher: row.smtpPass,
      smtpSecure: row.smtpSecure === 1,
      imapHost: row.imapHost,
      imapPort: row.imapPort,
      imapUser: row.imapUser,
      imapPassCipher: row.imapPass,
      imapSecure: (row.imapSecure ?? 1) === 1,
      lastSyncAt: row.lastSyncAt,
      isShared: row.isShared === 1,
      ownerId: row.ownerId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  },
}
