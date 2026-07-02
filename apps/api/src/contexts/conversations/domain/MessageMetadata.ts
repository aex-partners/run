import { Json, JsonObject, isJsonObject } from '@/shared/domain/Json'

// The shapes the UI puts inside a message's `metadata` JSON blob. The source
// stores `metadata` as an opaque JSON string with any of these optional keys; we
// keep it a JsonObject so arbitrary keys round-trip, but expose typed builders
// for the ones the app sets.
export interface ReplyTo {
  id: string
  author: string
  content: string
}

export type AttachmentKind = 'image' | 'file'

export interface Attachment {
  fileId: string
  name: string
  mimeType: string
  size: string
  kind: AttachmentKind
}

export interface ForwardedFrom {
  messageId: string
  authorName: string
}

// Build the metadata JsonObject from the optional pieces a send may carry.
// Returns null when nothing is set (matches the source: empty metadata is NULL).
export const buildMetadata = (parts: {
  replyTo?: ReplyTo
  attachments?: readonly Attachment[]
  forwardedFrom?: ForwardedFrom
}): JsonObject | null => {
  const meta: JsonObject = {}
  if (parts.replyTo) meta.replyTo = { ...parts.replyTo }
  if (parts.attachments && parts.attachments.length > 0) {
    meta.attachments = parts.attachments.map((a) => ({ ...a }))
  }
  if (parts.forwardedFrom) meta.forwardedFrom = { ...parts.forwardedFrom }
  return Object.keys(meta).length > 0 ? meta : null
}

// Read the attachments back out of a metadata blob (used to grant file ACLs).
export const readAttachments = (meta: JsonObject | null): Attachment[] => {
  if (!meta) return []
  const raw = meta.attachments
  if (!Array.isArray(raw)) return []
  const out: Attachment[] = []
  for (const item of raw) {
    if (!isJsonObject(item)) continue
    const { fileId, name, mimeType, size, kind } = item
    if (
      typeof fileId === 'string' &&
      typeof name === 'string' &&
      typeof mimeType === 'string' &&
      typeof size === 'string' &&
      (kind === 'image' || kind === 'file')
    ) {
      out.push({ fileId, name, mimeType, size, kind })
    }
  }
  return out
}

// Pure: flip metadata.quickReplies.answered to true if a quickReplies block is
// present. Returns a new metadata object (or the input unchanged when absent).
export const markQuickRepliesAnswered = (meta: JsonObject | null): JsonObject | null => {
  if (!meta) return meta
  const qr: Json | undefined = meta.quickReplies
  if (qr === undefined || !isJsonObject(qr)) return meta
  return { ...meta, quickReplies: { ...qr, answered: true } }
}
