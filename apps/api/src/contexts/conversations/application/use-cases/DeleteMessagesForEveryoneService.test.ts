import { describe, it, expect } from 'vitest'
import { DeleteMessagesForEveryoneService } from '@/contexts/conversations/application/use-cases/DeleteMessagesForEveryoneService'
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

const mkMessage = (id: string, conversationId: string, authorId: string | null): Message =>
  Message.rehydrate({
    id: MessageId.of(id),
    conversationId,
    authorId,
    agentId: null,
    content: 'hello',
    role: 'user',
    metadata: null,
    pinned: false,
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

describe('DeleteMessagesForEveryoneService', () => {
  it('soft-deletes the author\'s messages, saves them, and publishes MessageDeleted', async () => {
    const m1 = mkMessage('m1', 'c1', 'author')
    const store = new Map<string, Message>([['m1', m1]])
    const messages = new FakeMessageRepo(store)
    const members = new FakeMemberRepo({ c1: ['author', 'bob'] })
    const events = new RecordingPublisher()
    const service = new DeleteMessagesForEveryoneService(messages, members, events, fixedClock(NOW))

    const res = await service.execute({ userId: 'author', messageIds: ['m1'] })

    expect(res.ok).toBe(true)
    expect(messages.saved).toHaveLength(1)
    expect(m1.deletedAt).toEqual(NOW)
    expect(events.events.map((e) => e.name)).toContain('conversations.MessageDeleted')
  })

  it('fails the call when the user is not the author and saves nothing', async () => {
    const m1 = mkMessage('m1', 'c1', 'author')
    const store = new Map<string, Message>([['m1', m1]])
    const messages = new FakeMessageRepo(store)
    const members = new FakeMemberRepo({ c1: ['author', 'intruder'] })
    const events = new RecordingPublisher()
    const service = new DeleteMessagesForEveryoneService(messages, members, events, fixedClock(NOW))

    const res = await service.execute({ userId: 'intruder', messageIds: ['m1'] })

    expect(res.ok).toBe(false)
    expect(messages.saved).toHaveLength(0)
    expect(m1.deletedAt).toBeNull()
    expect(events.events).toHaveLength(0)
  })

  it('skips message ids that do not resolve and still succeeds', async () => {
    const messages = new FakeMessageRepo(new Map())
    const members = new FakeMemberRepo({})
    const events = new RecordingPublisher()
    const service = new DeleteMessagesForEveryoneService(messages, members, events, fixedClock(NOW))

    const res = await service.execute({ userId: 'author', messageIds: ['missing'] })

    expect(res.ok).toBe(true)
    expect(messages.saved).toHaveLength(0)
  })
})
