import { describe, it, expect } from 'vitest'
import { StarMessageService } from '@/contexts/conversations/application/use-cases/StarMessageService'
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

const mkMessage = (id: string, conversationId: string, starred: boolean): Message =>
  Message.rehydrate({
    id: MessageId.of(id),
    conversationId,
    authorId: 'author',
    agentId: null,
    content: 'hello',
    role: 'user',
    metadata: null,
    pinned: false,
    starred,
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

describe('StarMessageService', () => {
  it('toggles star on, saves, and broadcasts MessageUpdated to members', async () => {
    const m1 = mkMessage('m1', 'c1', false)
    const messages = new FakeMessageRepo(new Map([['m1', m1]]))
    const members = new FakeMemberRepo({ c1: ['author', 'bob'] })
    const events = new RecordingPublisher()
    const service = new StarMessageService(messages, members, events, fixedClock(NOW))

    const res = await service.execute({ messageId: 'm1', userId: 'author' })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.starred).toBe(true)
    expect(m1.starred).toBe(true)
    expect(messages.saved).toHaveLength(1)
    expect(events.events.map((e) => e.name)).toContain('conversations.MessageUpdated')
  })

  it('toggles star off when already starred', async () => {
    const m1 = mkMessage('m1', 'c1', true)
    const messages = new FakeMessageRepo(new Map([['m1', m1]]))
    const members = new FakeMemberRepo({ c1: ['author'] })
    const service = new StarMessageService(messages, members, new RecordingPublisher(), fixedClock(NOW))

    const res = await service.execute({ messageId: 'm1', userId: 'author' })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.starred).toBe(false)
  })

  it('fails when the message does not exist', async () => {
    const messages = new FakeMessageRepo(new Map())
    const members = new FakeMemberRepo({})
    const service = new StarMessageService(messages, members, new RecordingPublisher(), fixedClock(NOW))

    const res = await service.execute({ messageId: 'missing', userId: 'author' })

    expect(res.ok).toBe(false)
  })

  it('blocks a non-member and saves nothing (anti-IDOR)', async () => {
    const m1 = mkMessage('m1', 'c1', false)
    const messages = new FakeMessageRepo(new Map([['m1', m1]]))
    const members = new FakeMemberRepo({ c1: ['author'] })
    const events = new RecordingPublisher()
    const service = new StarMessageService(messages, members, events, fixedClock(NOW))

    const res = await service.execute({ messageId: 'm1', userId: 'intruder' })

    expect(res.ok).toBe(false)
    expect(messages.saved).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })
})
