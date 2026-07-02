import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { Result, ok, fail } from '@/shared/kernel/Result'
import { EmailAccountId } from '@/contexts/email/domain/ids'
import { EmailAccountCreated } from '@/contexts/email/domain/events/EmailAccountCreated'
import { EmailAccountUpdated } from '@/contexts/email/domain/events/EmailAccountUpdated'
import { EmailAccountDeleted } from '@/contexts/email/domain/events/EmailAccountDeleted'

// Decrypted SMTP/IMAP settings the transport adapters consume. The aggregate
// never produces these itself — the use case decrypts the stored ciphertext
// through the Cipher out-port and hands the result to the adapter — so plaintext
// credentials never live on a persisted object.
export interface SmtpSettings {
  host: string
  port: number
  user: string
  pass: string
  from: string
  fromName: string | null
  secure: boolean
}

export interface ImapSettings {
  host: string
  port: number
  user: string
  pass: string
  secure: boolean
}

// The credential fields are CIPHERTEXT, exactly as stored. The Cipher boundary
// lives in the application/adapter layer; the aggregate is a faithful holder of
// what is on disk.
export interface EmailAccountSnapshot {
  displayName: string
  emailAddress: string
  fromName: string | null
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPassCipher: string
  smtpSecure: boolean
  imapHost: string | null
  imapPort: number | null
  imapUser: string | null
  imapPassCipher: string | null
  imapSecure: boolean
  lastSyncAt: Date | null
  isShared: boolean
  ownerId: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateEmailAccountProps {
  displayName: string
  emailAddress: string
  fromName?: string | null
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPassCipher: string
  smtpSecure: boolean
  imapHost?: string | null
  imapPort?: number | null
  imapUser?: string | null
  imapPassCipher?: string | null
  imapSecure?: boolean
  isShared: boolean
  ownerId: string
}

// Fields a mailbox owner may edit. Passwords arrive pre-encrypted (or absent to
// leave the stored one untouched). Mirrors the AEX mailAccounts.update shape.
export interface UpdateEmailAccountProps {
  displayName?: string
  emailAddress?: string
  fromName?: string | null
  smtpHost?: string
  smtpPort?: number
  smtpUser?: string
  smtpPassCipher?: string
  smtpSecure?: boolean
  isShared?: boolean
}

// AGGREGATE. A configured mailbox (SMTP for sending, optional IMAP for sync). It
// owns the access invariants — only the owner edits or shares it — and exposes
// the connection settings the transport adapters need, but holds credentials as
// ciphertext so the secret never sits in cleartext on a domain object.
export class EmailAccount extends AggregateRoot<EmailAccountId> {
  private constructor(
    id: EmailAccountId,
    public readonly ownerId: string,
    private _displayName: string,
    private _emailAddress: string,
    private _fromName: string | null,
    private _smtpHost: string,
    private _smtpPort: number,
    private _smtpUser: string,
    private _smtpPassCipher: string,
    private _smtpSecure: boolean,
    private _imapHost: string | null,
    private _imapPort: number | null,
    private _imapUser: string | null,
    private _imapPassCipher: string | null,
    private _imapSecure: boolean,
    private _lastSyncAt: Date | null,
    private _isShared: boolean,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super(id)
  }

  static create(id: EmailAccountId, props: CreateEmailAccountProps, now: Date): Result<EmailAccount> {
    if (props.displayName.trim().length < 1) return fail('EmailAccount: display name is required')
    if (props.emailAddress.trim().length < 1) return fail('EmailAccount: email address is required')
    if (props.smtpHost.trim().length < 1) return fail('EmailAccount: SMTP host is required')
    if (props.smtpPort < 1 || props.smtpPort > 65535) return fail('EmailAccount: SMTP port out of range')

    const account = new EmailAccount(
      id,
      props.ownerId,
      props.displayName.trim(),
      props.emailAddress.trim(),
      props.fromName ?? null,
      props.smtpHost,
      props.smtpPort,
      props.smtpUser,
      props.smtpPassCipher,
      props.smtpSecure,
      props.imapHost ?? null,
      props.imapPort ?? null,
      props.imapUser ?? null,
      props.imapPassCipher ?? null,
      props.imapSecure ?? true,
      null,
      props.isShared,
      now,
      now,
    )
    account.addEvent(new EmailAccountCreated(id.value, props.ownerId, account._emailAddress, now))
    return ok(account)
  }

  static rehydrate(id: EmailAccountId, s: EmailAccountSnapshot): EmailAccount {
    return new EmailAccount(
      id,
      s.ownerId,
      s.displayName,
      s.emailAddress,
      s.fromName,
      s.smtpHost,
      s.smtpPort,
      s.smtpUser,
      s.smtpPassCipher,
      s.smtpSecure,
      s.imapHost,
      s.imapPort,
      s.imapUser,
      s.imapPassCipher,
      s.imapSecure,
      s.lastSyncAt,
      s.isShared,
      s.createdAt,
      s.updatedAt,
    )
  }

  update(props: UpdateEmailAccountProps, now: Date): Result<void> {
    if (props.displayName !== undefined) {
      if (props.displayName.trim().length < 1) return fail('EmailAccount: display name is required')
      this._displayName = props.displayName.trim()
    }
    if (props.emailAddress !== undefined) this._emailAddress = props.emailAddress.trim()
    if (props.fromName !== undefined) this._fromName = props.fromName || null
    if (props.smtpHost !== undefined) this._smtpHost = props.smtpHost
    if (props.smtpPort !== undefined) {
      if (props.smtpPort < 1 || props.smtpPort > 65535) return fail('EmailAccount: SMTP port out of range')
      this._smtpPort = props.smtpPort
    }
    if (props.smtpUser !== undefined) this._smtpUser = props.smtpUser
    if (props.smtpPassCipher !== undefined) this._smtpPassCipher = props.smtpPassCipher
    if (props.smtpSecure !== undefined) this._smtpSecure = props.smtpSecure
    if (props.isShared !== undefined) this._isShared = props.isShared
    this._updatedAt = now
    this.addEvent(new EmailAccountUpdated(this.id.value, now))
    return ok(undefined)
  }

  // Stamps the deletion event; the repository removes the row (cascades drop
  // emails + members per the schema FKs).
  markDeleted(now: Date): void {
    this.addEvent(new EmailAccountDeleted(this.id.value, now))
  }

  recordSync(at: Date): void {
    this._lastSyncAt = at
    this._updatedAt = at
  }

  isOwnedBy(userId: string): boolean {
    return this.ownerId === userId
  }

  hasImap(): boolean {
    return !!this._imapHost && !!this._imapUser && !!this._imapPassCipher
  }

  // Connection settings with the credential still ciphertext. The use case
  // decrypts `pass` via the Cipher port before reaching a transport adapter.
  smtpSettingsCipher(): SmtpSettings {
    return {
      host: this._smtpHost,
      port: this._smtpPort,
      user: this._smtpUser,
      pass: this._smtpPassCipher,
      from: this._emailAddress,
      fromName: this._fromName,
      secure: this._smtpSecure,
    }
  }

  imapSettingsCipher(): ImapSettings | null {
    if (!this._imapHost || !this._imapUser || !this._imapPassCipher) return null
    return {
      host: this._imapHost,
      port: this._imapPort ?? 993,
      user: this._imapUser,
      pass: this._imapPassCipher,
      secure: this._imapSecure,
    }
  }

  get displayName(): string {
    return this._displayName
  }
  get emailAddress(): string {
    return this._emailAddress
  }
  get fromName(): string | null {
    return this._fromName
  }
  get smtpHost(): string {
    return this._smtpHost
  }
  get smtpPort(): number {
    return this._smtpPort
  }
  get smtpUser(): string {
    return this._smtpUser
  }
  get smtpPassCipher(): string {
    return this._smtpPassCipher
  }
  get smtpSecure(): boolean {
    return this._smtpSecure
  }
  get imapHost(): string | null {
    return this._imapHost
  }
  get imapPort(): number | null {
    return this._imapPort
  }
  get imapUser(): string | null {
    return this._imapUser
  }
  get imapPassCipher(): string | null {
    return this._imapPassCipher
  }
  get imapSecure(): boolean {
    return this._imapSecure
  }
  get lastSyncAt(): Date | null {
    return this._lastSyncAt
  }
  get isShared(): boolean {
    return this._isShared
  }
  get createdAt(): Date {
    return this._createdAt
  }
  get updatedAt(): Date {
    return this._updatedAt
  }
}
