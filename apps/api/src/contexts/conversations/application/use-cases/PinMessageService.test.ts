import { describe, it, expect } from 'vitest'
import { PinMessageService } from '@/contexts/conversations/application/use-cases/PinMessageService'
import { MessageRepository } from '@/contexts/conversations/application/ports/out/MessageRepository'
import { ConversationMemberRepository } from '@/contexts/conversations/application/ports/out/ConversationMemberRepository'
import { Message } from '@/contexts/conversations/domain/Message'
import { ConversationMember } from '@/contexts/conversations/domain/ConversationMember'
import { MessageId, ConversationId } from '@/contexts/conversations/domain/ids'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2026-01-01T00:00:00Z')
const fixedClock = (now: Date): Clock => ({ now: () => now })

const mkMessage = (id: string, conversationId: string, pinned: boolean): Message =>
  Message.rehydrate({
    id: MessageId.of(id),
    conversationId,
    authorId: 'author',
    agentId: null,
    content: 'hello',
    role: 'user',
    metadata: null,
    pinned,
    starred: false,
    deletedAt: null,
    deletedFor: [],
    reactions: [],
    audio: null,
    createdAt: NOW,
  })

class FakeMessageRepo implements MessageRepository {
  readonly saved: Message[] = []
  constructor(private store: Map<string, Message>) {}
  nextId(): MessageId {
    return MessageId.of('m-x')
  }
  async findById(id: MessageId): Promise<Message | null> {
    return this.store.get(id.value) ?? null
  }
  async save(message: Message): Promise<void> {
    this.saved.push(message)
  }
  async saveMany(): Promise<void> {}
}

class FakeMemberRepo implements ConversationMemberRepository {
  constructor(private membership: Record<string, string[]>) {}
  async findMember(conversationId: ConversationId, userId: string): Promise<ConversationMember | null> {
    const ids = this.membership[conversationId.value] ?? []
    return ids.includes(userId) ? ConversationMember.create(userId, NOW) : null
  }
  async listMemberIds(conversationId: ConversationId): Promise<string[]> {
    return [...(this.membership[conversationId.value] ?? [])]
  }
  async add(): Promise<void> {}
  async save(): Promise<void> {}
}

class RecordingPublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.events.push(...events)
  }
}

describe('PinMessageService', () => {
  it('toggles pin on, saves, and broadcasts MessageUpdated to members', async () => {
    const m1 = mkMessage('m1', 'c1', false)
    const messages = new FakeMessageRepo(new Map([['m1', m1]]))
    const members = new FakeMemberRepo({ c1: ['author', 'bob'] })
    const events = new RecordingPublisher()
    const service = new PinMessageService(messages, members, events, fixedClock(NOW))

    const res = await service.execute({ messageId: 'm1', userId: 'author' })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.pinned).toBe(true)
    expect(m1.pinned).toBe(true)
    expect(messages.saved).toHaveLength(1)
    expect(events.events.map((e) => e.name)).toContain('conversations.MessageUpdated')
  })

  it('toggles pin off when already pinned', async () => {
    const m1 = mkMessage('m1', 'c1', true)
    const messages = new FakeMessageRepo(new Map([['m1', m1]]))
    const members = new FakeMemberRepo({ c1: ['author'] })
    const service = new PinMessageService(messages, members, new RecordingPublisher(), fixedClock(NOW))

    const res = await service.execute({ messageId: 'm1', userId: 'author' })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.pinned).toBe(false)
  })

  it('fails when the message does not exist', async () => {
    const messages = new FakeMessageRepo(new Map())
    const members = new FakeMemberRepo({})
    const service = new PinMessageService(messages, members, new RecordingPublisher(), fixedClock(NOW))

    const res = await service.execute({ messageId: 'missing', userId: 'author' })

    expect(res.ok).toBe(false)
  })

  it('blocks a non-member of the message\'s conversation and saves nothing (anti-IDOR)', async () => {
    const m1 = mkMessage('m1', 'c1', false)
    const messages = new FakeMessageRepo(new Map([['m1', m1]]))
    const members = new FakeMemberRepo({ c1: ['author'] })
    const events = new RecordingPublisher()
    const service = new PinMessageService(messages, members, events, fixedClock(NOW))

    const res = await service.execute({ messageId: 'm1', userId: 'intruder' })

    expect(res.ok).toBe(false)
    expect(messages.saved).toHaveLength(0)
    expect(events.events).toHaveLength(0)
    expect(m1.pinned).toBe(false)
  })
})
