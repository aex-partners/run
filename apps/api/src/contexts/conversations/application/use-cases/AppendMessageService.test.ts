import { describe, it, expect } from 'vitest'
import { AppendMessageService } from '@/contexts/conversations/application/use-cases/AppendMessageService'
import { MessageRepository } from '@/contexts/conversations/application/ports/out/MessageRepository'
import { ConversationMemberRepository } from '@/contexts/conversations/application/ports/out/ConversationMemberRepository'
import { AttachmentResolver } from '@/contexts/conversations/application/ports/out/AttachmentResolver'
import { Message } from '@/contexts/conversations/domain/Message'
import { MessageId, ConversationId } from '@/contexts/conversations/domain/ids'
import { ConversationMember } from '@/contexts/conversations/domain/ConversationMember'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2026-01-01T00:00:00Z')
const fixedClock = (now: Date): Clock => ({ now: () => now })

class FakeMessageRepo implements MessageRepository {
  private seq = 0
  readonly saved: Message[] = []
  readonly savedMany: Message[][] = []
  nextId(): MessageId {
    this.seq += 1
    return MessageId.of(`m-${this.seq}`)
  }
  async findById(): Promise<Message | null> {
    return null
  }
  async save(message: Message): Promise<void> {
    this.saved.push(message)
  }
  async saveMany(messages: readonly Message[]): Promise<void> {
    this.savedMany.push([...messages])
  }
}

class FakeMemberRepo implements ConversationMemberRepository {
  constructor(private ids: string[]) {}
  async findMember(_c: ConversationId, userId: string): Promise<ConversationMember | null> {
    return this.ids.includes(userId) ? ConversationMember.create(userId, NOW) : null
  }
  async listMemberIds(): Promise<string[]> {
    return [...this.ids]
  }
  async add(): Promise<void> {}
  async save(): Promise<void> {}
}

class FakeAttachmentResolver implements AttachmentResolver {
  readonly grants: { fileIds: string[]; userIds: string[] }[] = []
  async grant(fileIds: string[], userIds: string[]): Promise<void> {
    this.grants.push({ fileIds, userIds })
  }
}

class RecordingPublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.events.push(...events)
  }
}

const setup = (memberIds: string[]) => {
  const messages = new FakeMessageRepo()
  const members = new FakeMemberRepo(memberIds)
  const attachments = new FakeAttachmentResolver()
  const events = new RecordingPublisher()
  const service = new AppendMessageService(messages, members, attachments, events, fixedClock(NOW))
  return { messages, members, attachments, events, service }
}

describe('AppendMessageService', () => {
  it('posts an authored message, saves it, and publishes MessagePosted to members minus the author', async () => {
    const { messages, events, service } = setup(['u1', 'u2', 'u3'])
    const res = await service.execute({
      conversationId: 'c1',
      authorId: 'u1',
      content: 'hi',
      role: 'user',
      requireMembership: true,
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.id).toBe('m-1')
    expect(res.value.content).toBe('hi')
    expect(messages.saved).toHaveLength(1)
    const posted = events.events.find((e) => e.name === 'conversations.MessagePosted') as
      | { recipientIds: readonly string[] }
      | undefined
    expect(posted?.recipientIds).toEqual(['u2', 'u3'])
  })

  it('enforces membership when requireMembership and an author are set', async () => {
    const { messages, events, service } = setup(['u2', 'u3'])
    const res = await service.execute({
      conversationId: 'c1',
      authorId: 'u1',
      content: 'hi',
      role: 'user',
      requireMembership: true,
    })
    expect(res.ok).toBe(false)
    expect(messages.saved).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })

  it('skips the membership guard for system/AI posts (no author)', async () => {
    const { service } = setup(['u2', 'u3'])
    const res = await service.execute({
      conversationId: 'c1',
      authorId: null,
      content: 'system notice',
      role: 'system',
      requireMembership: false,
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // No author => audience is all members.
    const ok2 = await service.execute({
      conversationId: 'c1',
      authorId: null,
      agentId: 'a1',
      content: 'ai turn',
      role: 'ai',
      requireMembership: false,
    })
    expect(ok2.ok).toBe(true)
  })

  it('grants the other members read access to attachments on an authored send', async () => {
    const { attachments, service } = setup(['u1', 'u2', 'u3'])
    const res = await service.execute({
      conversationId: 'c1',
      authorId: 'u1',
      content: 'see file',
      role: 'user',
      requireMembership: true,
      attachments: [{ fileId: 'f1', name: 'a.pdf', mimeType: 'application/pdf', size: '1', kind: 'file' }],
    })
    expect(res.ok).toBe(true)
    expect(attachments.grants).toEqual([{ fileIds: ['f1'], userIds: ['u2', 'u3'] }])
  })

  it('does not grant attachments when there is no author', async () => {
    const { attachments, service } = setup(['u1', 'u2'])
    await service.execute({
      conversationId: 'c1',
      authorId: null,
      content: 'x',
      role: 'system',
      requireMembership: false,
      attachments: [{ fileId: 'f1', name: 'a.pdf', mimeType: 'application/pdf', size: '1', kind: 'file' }],
    })
    expect(attachments.grants).toHaveLength(0)
  })

  it('fails on an empty message without saving or publishing', async () => {
    const { messages, events, service } = setup(['u1'])
    const res = await service.execute({
      conversationId: 'c1',
      authorId: 'u1',
      content: '   ',
      role: 'user',
      requireMembership: true,
    })
    expect(res.ok).toBe(false)
    expect(messages.saved).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })

  it('builds an audio payload with transcriptionEdited false', async () => {
    const { messages, service } = setup(['u1', 'u2'])
    const res = await service.execute({
      conversationId: 'c1',
      authorId: 'u1',
      content: '',
      role: 'user',
      requireMembership: true,
      audio: { url: 'http://a', duration: '5' },
    })
    expect(res.ok).toBe(true)
    expect(messages.saved[0].audio).toEqual({
      url: 'http://a',
      duration: '5',
      waveform: null,
      transcription: null,
      transcriptionEdited: false,
    })
  })
})
