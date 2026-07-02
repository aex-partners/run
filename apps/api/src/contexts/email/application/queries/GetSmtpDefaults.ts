// Read side (CQRS). Backs emails.mailAccounts.getDefaults: server-level SMTP
// host/port/secure read from settings, used to pre-fill the account form. Null
// when no defaults are configured.
export interface SmtpDefaults {
  host: string
  port: number
  secure: boolean
}

export interface GetSmtpDefaults {
  execute(): Promise<SmtpDefaults | null>
}
