// Driven port for SMTP/IMAP auto-discovery. Probing known providers, Mozilla
// autoconfig, MX records and common host patterns is network IO, so it lives
// behind a port; the adapter ports AEX email/autodiscover.ts (DNS + sockets +
// fetch). Returns null when nothing could be discovered.
export interface DiscoveredMailSettings {
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  imapHost: string
  imapPort: number
  imapSecure: boolean
}

export interface EmailAutodiscovery {
  discover(email: string): Promise<DiscoveredMailSettings | null>
}
