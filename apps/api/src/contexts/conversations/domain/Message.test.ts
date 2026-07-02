import { describe, it, expect } from 'vitest'
import { Message } from '@/contexts/conversations/domain/Message'
import { MessageId } from '@/contexts/conversations/domain/ids'
import {
  buildMetadata,
  readAttachments,
  markQuickRepliesAnswered,
  Attachment,
} from '@/contexts/conversations/domain/MessageMetadata'
import { JsonObject } from '@/shared/domain/Json'

const NOW = new Date('2026-01-01T00:00:00Z')
const mid = (v: string) => MessageId.of(v)

const att: Attachment = {
  fileId: 'f1',
  name: 'doc.pdf',
  mimeType: 'application/pdf',
  size: '12',
  kind: 'file',
}

const post = (overrides: Partial<Parameters<typeof Message.post>[0]> = {}) =>
  Message.post({
    id: mid('m1'),
    conversationId: 'c1',
    authorId: 'u1',
    agentId: null,
    content: 'hello',
    role: 'user',
    metadata: null,
    audio: null,
    recipientIds: ['u2', 'u3'],
    now: NOW,
    ...overrides,
  })

describe('Message.post', () => {
  it('creates a text message with the default flags and records MessagePosted', () => {
    const res = post()
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const m = res.value
    expect(m.role).toBe('user')
    expect(m.content).toBe('hello')
    expect(m.pinned).toBe(false)
    expect(m.starred).toBe(false)
    expect(m.deletedAt).toBeNull()
    expect(m.deletedFor).toEqual([])
    expect(m.reactions).toEqual([])
    expect(m.createdAt).toBe(NOW)

    const events = m.pullEvents() as Array<{ name: string; recipientIds: readonly string[]; role: string }>
    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('conversations.MessagePosted')
    expect(events[0].recipientIds).toEqual(['u2', 'u3'])
    expect(events[0].role).toBe('user')
  })

  it('rejects an empty message (no text, no attachment, no audio)', () => {
    const res = post({ content: '   ', metadata: null, audio: null })
    expect(res.ok).toBe(false)
  })

  it('accepts an attachment-only message', () => {
    const res = post({ content: '', metadata: buildMetadata({ attachments: [att] }) })
    expect(res.ok).toBe(true)
  })

  it('accepts an audio-only message and stamps transcriptionEdited false', () => {
    const res = post({
      content: '',
      audio: { url: 'u', duration: '3', waveform: null, transcription: null, transcriptionEdited: false },
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.audio?.transcriptionEdited).toBe(false)
  })

  it('supports the ai and system roles', () => {
    expect(post({ role: 'ai', authorId: null, agentId: 'a1' }).ok).toBe(true)
    expect(post({ role: 'system', authorId: null }).ok).toBe(true)
  })
})

describe('Message.rehydrate', () => {
  it('restores state and copies the mutable arrays defensively', () => {
    const reactions = [{ emoji: '👍', userId: 'u2' }]
    const deletedFor = ['u9']
    const m = Message.rehydrate({
      id: mid('m1'),
      conversationId: 'c1',
      authorId: 'u1',
      agentId: null,
      content: 'hi',
      role: 'user',
      metadata: null,
      pinned: true,
      starred: true,
      deletedAt: null,
      deletedFor,
      reactions,
      audio: null,
      createdAt: NOW,
    })
    expect(m.pinned).toBe(true)
    expect(m.starred).toBe(true)
    expect(m.reactions).toEqual(reactions)
    expect(m.reactions).not.toBe(reactions)
    expect(m.deletedFor).toEqual(deletedFor)
    expect(m.deletedFor).not.toBe(deletedFor)
    expect(m.pullEvents()).toHaveLength(0)
  })
})

describe('Message reactions', () => {
  it('toggles an emoji on then off for the same user, recording MessageUpdated each time', () => {
    const res = post()
    if (!res.ok) return
    const m = res.value
    m.pullEvents()

    const after = m.react('u2', '🔥', ['u3'], NOW)
    expect(after).toEqual([{ emoji: '🔥', userId: 'u2' }])
    let events = m.pullEvents() as Array<{ name: string }>
    expect(events[0].name).toBe('conversations.MessageUpdated')

    const removed = m.react('u2', '🔥', ['u3'], NOW)
    expect(removed).toEqual([])
    events = m.pullEvents() as Array<{ name: string }>
    expect(events[0].name).toBe('conversations.MessageUpdated')
  })
})

describe('Message pin / star', () => {
  it('togglePin flips and reports the new state, recording MessageUpdated', () => {
    const res = post()
    if (!res.ok) return
    const m = res.value
    m.pullEvents()
    expect(m.togglePin(['u2'], NOW)).toBe(true)
    expect(m.pinned).toBe(true)
    expect((m.pullEvents()[0] as { name: string }).name).toBe('conversations.MessageUpdated')
    expect(m.togglePin(['u2'], NOW)).toBe(false)
    expect(m.pinned).toBe(false)
  })

  it('toggleStar flips and reports the new state', () => {
    const res = post()
    if (!res.ok) return
    const m = res.value
    expect(m.toggleStar(['u2'], NOW)).toBe(true)
    expect(m.starred).toBe(true)
    expect(m.toggleStar(['u2'], NOW)).toBe(false)
  })
})

describe('Message soft-delete', () => {
  it('deleteForEveryone is author-only', () => {
    const res = post()
    if (!res.ok) return
    const m = res.value
    const denied = m.deleteForEveryone('u2', ['u2'], NOW)
    expect(denied.ok).toBe(false)
    expect(m.deletedAt).toBeNull()
  })

  it('deleteForEveryone stamps deletedAt and records MessageDeleted for the author', () => {
    const res = post()
    if (!res.ok) return
    const m = res.value
    m.pullEvents()
    const done = m.deleteForEveryone('u1', ['u2', 'u3'], NOW)
    expect(done.ok).toBe(true)
    expect(m.deletedAt).toBe(NOW)
    expect((m.pullEvents()[0] as { name: string }).name).toBe('conversations.MessageDeleted')
  })

  it('deleteForMe hides per-user without an event and is idempotent', () => {
    const res = post()
    if (!res.ok) return
    const m = res.value
    m.pullEvents()
    m.deleteForMe('u2')
    m.deleteForMe('u2')
    expect(m.deletedFor).toEqual(['u2'])
    expect(m.pullEvents()).toHaveLength(0)
  })

  it('isDeletedFor folds delete-for-everyone and delete-for-me', () => {
    const res = post()
    if (!res.ok) return
    const m = res.value
    expect(m.isDeletedFor('u2')).toBe(false)
    m.deleteForMe('u2')
    expect(m.isDeletedFor('u2')).toBe(true)
    expect(m.isDeletedFor('u3')).toBe(false)
    m.deleteForEveryone('u1', [], NOW)
    // delete-for-everyone makes it deleted for everyone, including u3.
    expect(m.isDeletedFor('u3')).toBe(true)
  })
})

describe('Message.editTranscription', () => {
  it('is author-only', () => {
    const res = post({
      content: '',
      audio: { url: 'u', duration: '3', waveform: null, transcription: 'a', transcriptionEdited: false },
    })
    if (!res.ok) return
    const r = res.value.editTranscription('u2', 'edited')
    expect(r.ok).toBe(false)
  })

  it('fails when the message has no audio', () => {
    const res = post()
    if (!res.ok) return
    const r = res.value.editTranscription('u1', 'edited')
    expect(r.ok).toBe(false)
  })

  it('sets the transcription and the edited flag, leaving content untouched', () => {
    const res = post({
      content: 'orig',
      audio: { url: 'u', duration: '3', waveform: null, transcription: 'auto', transcriptionEdited: false },
    })
    if (!res.ok) return
    const m = res.value
    const r = m.editTranscription('u1', 'corrected')
    expect(r.ok).toBe(true)
    expect(m.audio?.transcription).toBe('corrected')
    expect(m.audio?.transcriptionEdited).toBe(true)
    expect(m.content).toBe('orig')
  })
})

describe('Message.markQuickReplyAnswered', () => {
  it('flips the quickReplies.answered flag when present', () => {
    const meta: JsonObject = { quickReplies: { options: ['a', 'b'], answered: false } }
    const res = post({ metadata: meta })
    if (!res.ok) return
    const m = res.value
    m.markQuickReplyAnswered()
    const qr = (m.metadata as JsonObject).quickReplies as JsonObject
    expect(qr.answered).toBe(true)
  })

  it('is a no-op when no quickReplies block is present', () => {
    const res = post({ metadata: { other: 1 } })
    if (!res.ok) return
    const m = res.value
    m.markQuickReplyAnswered()
    expect(m.metadata).toEqual({ other: 1 })
  })
})

describe('MessageMetadata value object', () => {
  it('buildMetadata returns null when nothing is set', () => {
    expect(buildMetadata({})).toBeNull()
    expect(buildMetadata({ attachments: [] })).toBeNull()
  })

  it('buildMetadata assembles replyTo, attachments and forwardedFrom', () => {
    const meta = buildMetadata({
      replyTo: { id: 'm0', author: 'Ann', content: 'prev' },
      attachments: [att],
      forwardedFrom: { messageId: 'm9', authorName: 'Bob' },
    })
    expect(meta).not.toBeNull()
    expect(meta!.replyTo).toEqual({ id: 'm0', author: 'Ann', content: 'prev' })
    expect((meta!.attachments as unknown[]).length).toBe(1)
    expect(meta!.forwardedFrom).toEqual({ messageId: 'm9', authorName: 'Bob' })
  })

  it('readAttachments parses valid entries and drops malformed ones', () => {
    const meta = buildMetadata({ attachments: [att] })
    expect(readAttachments(meta)).toEqual([att])
    expect(readAttachments(null)).toEqual([])
    expect(readAttachments({ attachments: 'nope' })).toEqual([])
    expect(readAttachments({ attachments: [{ fileId: 'f', name: 'n', mimeType: 'm', size: '1', kind: 'bogus' }] })).toEqual(
      [],
    )
  })

  it('markQuickRepliesAnswered returns the input unchanged when absent and a new object when present', () => {
    expect(markQuickRepliesAnswered(null)).toBeNull()
    const noQr: JsonObject = { foo: 1 }
    expect(markQuickRepliesAnswered(noQr)).toBe(noQr)
    const withQr: JsonObject = { quickReplies: { answered: false } }
    const out = markQuickRepliesAnswered(withQr)
    expect(out).not.toBe(withQr)
    expect((out!.quickReplies as JsonObject).answered).toBe(true)
  })
})
