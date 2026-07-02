import { ImapFlow } from 'imapflow'
import { ImapSettings } from '@/contexts/email/domain/EmailAccount'
import { EmailFolder } from '@/contexts/email/domain/EmailFolder'
import { ImapClient, FetchedMessage, FetchResult } from '@/contexts/email/application/ports/out/ImapClient'

// Driven adapter for the ImapClient port. Ports AEX email/sync.ts connect/list/
// fetch + raw MIME body parsing, but performs NO persistence: it returns parsed
// messages (read-only fetch, no deletions) and leaves threading + storage to the
// SyncAccount use case. `settings.pass` is already decrypted upstream.
export class ImapflowClient implements ImapClient {
  private client(settings: ImapSettings): ImapFlow {
    return new ImapFlow({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: { user: settings.user, pass: settings.pass },
      logger: false,
      emitLogs: false,
    })
  }

  async fetchAll(settings: ImapSettings): Promise<FetchResult> {
    const client = this.client(settings)
    const messages: FetchedMessage[] = []
    let errors = 0

    try {
      await client.connect()
      const mailboxes = await client.list()
      const toSync = mailboxes.filter((mb) =>
        ['inbox', 'sent', 'drafts', 'spam', 'trash'].includes(mapFolder(mb.path, mb.specialUse)),
      )

      for (const mailbox of toSync) {
        const folder = mapFolder(mailbox.path, mailbox.specialUse)
        let lock
        try {
          lock = await client.getMailboxLock(mailbox.path)
        } catch {
          errors++
          continue
        }
        try {
          const total = client.mailbox && typeof client.mailbox !== 'boolean' ? client.mailbox.exists : 0
          if (!total) continue

          for await (const msg of client.fetch('1:*', {
            envelope: true,
            source: true,
            bodyStructure: true,
            flags: true,
          })) {
            try {
              messages.push(toFetchedMessage(msg, folder))
            } catch {
              errors++
            }
          }
        } finally {
          lock.release()
        }
      }
    } finally {
      await client.logout().catch(() => {})
    }

    return { messages, errors }
  }

  async verify(settings: ImapSettings): Promise<{ ok: boolean; error?: string }> {
    const client = this.client(settings)
    try {
      await client.connect()
      await client.logout()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'IMAP connection failed' }
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toFetchedMessage(msg: any, folder: EmailFolder): FetchedMessage {
  const externalId: string = msg.envelope?.messageId || `${msg.uid}`
  const from = extractAddress(msg.envelope?.from)
  const to = extractAddressList(msg.envelope?.to)
  const cc = extractAddressList(msg.envelope?.cc)
  const subject: string = msg.envelope?.subject || '(No subject)'
  const date: Date = msg.envelope?.date ? new Date(msg.envelope.date) : new Date()

  let bodyText = ''
  let bodyHtml = ''
  if (msg.source) {
    const parsed = parseRawEmail(msg.source.toString())
    bodyText = parsed.text
    bodyHtml = parsed.html
  }

  const flags: Set<string> = msg.flags instanceof Set ? msg.flags : new Set<string>()
  const hasAttachment = Array.isArray(msg.bodyStructure?.childNodes)
    ? msg.bodyStructure.childNodes.some((n: { disposition?: string }) => n.disposition === 'attachment')
    : false

  return {
    externalId,
    folder,
    fromName: from.name,
    fromEmail: from.email,
    to,
    cc,
    subject,
    bodyHtml: bodyHtml || null,
    bodyText: bodyText || null,
    read: flags.has('\\Seen'),
    starred: flags.has('\\Flagged'),
    hasAttachment,
    date,
    inReplyTo: msg.envelope?.inReplyTo ?? null,
    references: [],
  }
}

// Map an IMAP mailbox (special-use flag or name heuristic) to one of our folders.
function mapFolder(path: string, specialUse?: string): EmailFolder {
  if (specialUse) {
    const map: Record<string, EmailFolder> = {
      '\\Inbox': 'inbox',
      '\\Sent': 'sent',
      '\\Drafts': 'drafts',
      '\\Junk': 'spam',
      '\\Trash': 'trash',
    }
    const mapped = map[specialUse]
    if (mapped) return mapped
  }
  const lower = path.toLowerCase()
  if (lower === 'inbox') return 'inbox'
  if (lower.includes('sent')) return 'sent'
  if (lower.includes('draft')) return 'drafts'
  if (lower.includes('spam') || lower.includes('junk') || lower.includes('lixo')) return 'spam'
  if (lower.includes('trash') || lower.includes('lixeira') || lower.includes('bin')) return 'trash'
  return 'inbox'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractAddress(addr: any): { name: string; email: string } {
  if (!addr || !addr.length) return { name: '', email: '' }
  const first = Array.isArray(addr) ? addr[0] : addr
  return { name: first?.name || first?.address || '', email: first?.address || '' }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractAddressList(addr: any): string[] {
  if (!addr) return []
  const list = Array.isArray(addr) ? addr : [addr]
  return list.map((a: { address?: string }) => a.address || '').filter(Boolean)
}

// ---------------------------------------------------------------------------
// Raw email body parser (handles nested multipart). Ported from AEX sync.ts.
// ---------------------------------------------------------------------------

interface ParsedBody {
  text: string
  html: string
}

function parseRawEmail(raw: string): ParsedBody {
  const result: ParsedBody = { text: '', html: '' }
  parsePart(raw, result)
  return result
}

function getCharset(headers: string): string {
  const match = headers.match(/charset=\s*["']?([^";\s\r\n]+)["']?/i)
  return match && match[1] ? match[1].toLowerCase() : 'utf-8'
}

function decodeWithCharset(bytes: Buffer, charset: string): string {
  try {
    return bytes.toString(charset as BufferEncoding)
  } catch {
    return bytes.toString('utf-8')
  }
}

function parsePart(raw: string, result: ParsedBody): void {
  let headerEnd = raw.indexOf('\r\n\r\n')
  let separatorLen = 4
  if (headerEnd === -1) {
    headerEnd = raw.indexOf('\n\n')
    separatorLen = 2
  }
  if (headerEnd === -1) {
    if (!result.text) result.text = raw
    return
  }

  const headers = raw.slice(0, headerEnd)
  const headersLower = headers.toLowerCase()
  const body = raw.slice(headerEnd + separatorLen)
  const charset = getCharset(headers)

  const boundaryMatch = headersLower.match(/boundary="?([^";\r\n]+)"?/)

  if (boundaryMatch && boundaryMatch[1]) {
    const boundary = boundaryMatch[1].trim()
    const parts = body.split(`--${boundary}`)
    for (const part of parts) {
      const trimmed = part.trim()
      if (trimmed === '--' || trimmed === '') continue
      if (part.startsWith('--')) continue
      const cleanPart = part.replace(/--\s*$/, '')
      parsePart(cleanPart.replace(/^\r?\n/, ''), result)
    }
  } else {
    let content = body.replace(/--\s*$/, '').trim()
    if (headersLower.includes('quoted-printable')) {
      content = decodeQuotedPrintable(content, charset)
    } else if (headersLower.includes('base64')) {
      try {
        const bytes = Buffer.from(content.replace(/\s/g, ''), 'base64')
        content = decodeWithCharset(bytes, charset)
      } catch {
        // skip
      }
    }
    if (headersLower.includes('text/html') && !result.html) {
      result.html = content
    } else if (headersLower.includes('text/plain') && !result.text) {
      result.text = content
    }
  }
}

function decodeQuotedPrintable(str: string, charset: string): string {
  const cleaned = str.replace(/=\r?\n/g, '')
  const bytes: number[] = []
  let i = 0
  while (i < cleaned.length) {
    if (cleaned[i] === '=' && i + 2 < cleaned.length) {
      const hex = cleaned.slice(i + 1, i + 3)
      const code = parseInt(hex, 16)
      if (!Number.isNaN(code)) {
        bytes.push(code)
        i += 3
        continue
      }
    }
    bytes.push(cleaned.charCodeAt(i))
    i++
  }
  return decodeWithCharset(Buffer.from(bytes), charset)
}
