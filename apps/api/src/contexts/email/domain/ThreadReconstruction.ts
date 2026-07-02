// Pure domain service. The rule that decides which conversation an incoming
// message belongs to, kept out of the IMAP adapter so it stays testable and
// provider-agnostic.
//
// AEX's sync derived `threadId` from the In-Reply-To header alone. This widens
// that minimally without reaching for the wire format: prefer In-Reply-To (the
// direct parent), else the last entry of the References chain (the nearest
// ancestor), else null — a root message starts its own thread, keyed elsewhere
// by its own Message-ID.
export interface MessageThreadingHeaders {
  messageId?: string | null
  inReplyTo?: string | null
  references?: readonly string[] | null
}

const clean = (value: string | null | undefined): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export const reconstructThreadId = (headers: MessageThreadingHeaders): string | null => {
  const inReplyTo = clean(headers.inReplyTo)
  if (inReplyTo) return inReplyTo

  const references = headers.references ?? []
  for (let i = references.length - 1; i >= 0; i--) {
    const ref = clean(references[i])
    if (ref) return ref
  }

  return null
}
