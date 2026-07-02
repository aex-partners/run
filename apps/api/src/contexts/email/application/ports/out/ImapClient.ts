import { ImapSettings } from '@/contexts/email/domain/EmailAccount'
import { EmailFolder } from '@/contexts/email/domain/EmailFolder'

// A message as pulled off the wire. The IMAP adapter has already mapped the
// mailbox to one of our folders and parsed the body; threading headers are left
// raw so the pure ThreadReconstruction rule (not the adapter) decides the thread.
export interface FetchedMessage {
  externalId: string
  folder: EmailFolder
  fromName: string
  fromEmail: string
  to: string[]
  cc: string[]
  subject: string
  bodyHtml: string | null
  bodyText: string | null
  read: boolean
  starred: boolean
  hasAttachment: boolean
  date: Date
  inReplyTo: string | null
  references: string[]
}

// Outcome of a fetch: the parsed messages plus a count of messages the adapter
// failed to parse (AEX tracked these as sync "errors").
export interface FetchResult {
  messages: FetchedMessage[]
  errors: number
}

// Driven port for inbound IMAP. The imapflow adapter ports AEX email/sync's
// connect/list/fetch + raw MIME parsing, but performs NO persistence: it returns
// fetched messages and the SyncAccount use case stores them. `settings.pass` is
// already decrypted by the use case.
export interface ImapClient {
  fetchAll(settings: ImapSettings): Promise<FetchResult>
  verify(settings: ImapSettings): Promise<{ ok: boolean; error?: string }>
}
