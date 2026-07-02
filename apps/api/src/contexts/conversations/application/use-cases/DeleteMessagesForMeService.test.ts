import { describe, it, expect } from 'vitest'
import { DeleteMessagesForMeService } from '@/contexts/conversations/application/use-cases/DeleteMessagesForMeService'
import { MessageRepository } from '@/contexts/conversations/application/ports/out/MessageRepository'
import { ConversationMemberRepository } from '@/contexts/conversations/application/ports/out/ConversationMemberRepository'
import { Message } from '@/contexts/conversations/domain/Message'
import { ConversationMember } from '@/contexts/conversations/domain/ConversationMember'
import { MessageId, ConversationId } from '@/contexts/conversations/domain/ids'

const NOW = new Date('2026-01-01T00:00:00Z')

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

describe('DeleteMessagesForMeService', () => {
  it('hides the message for the caller and saves it (no event)', async () => {
    const m1 = mkMessage('m1', 'c1', 'author')
    const store = new Map<string, Message>([['m1', m1]])
    const messages = new FakeMessageRepo(store)
    const members = new FakeMemberRepo({ c1: ['author', 'me'] })
    const service = new DeleteMessagesForMeService(messages, members)

    const res = await service.execute({ userId: 'me', messageIds: ['m1'] })

    expect(res.ok).toBe(true)
    expect(messages.saved).toHaveLength(1)
    expect(m1.isDeletedFor('me')).toBe(true)
    // Other members are unaffected.
    expect(m1.isDeletedFor('author')).toBe(false)
  })

  it('blocks a non-member of the message\'s conversation (anti-IDOR) and saves nothing', async () => {
    const m1 = mkMessage('m1', 'c1', 'author')
    const store = new Map<string, Message>([['m1', m1]])
    const messages = new FakeMessageRepo(store)
    const members = new FakeMemberRepo({ c1: ['author'] })
    const service = new DeleteMessagesForMeService(messages, members)

    const res = await service.execute({ userId: 'intruder', messageIds: ['m1'] })

    expect(res.ok).toBe(false)
    expect(messages.saved).toHaveLength(0)
    expect(m1.isDeletedFor('intruder')).toBe(false)
  })

  it('skips missing messages and still succeeds', async () => {
    const messages = new FakeMessageRepo(new Map())
    const members = new FakeMemberRepo({})
    const service = new DeleteMessagesForMeService(messages, members)

    const res = await service.execute({ userId: 'me', messageIds: ['missing'] })

    expect(res.ok).toBe(true)
    expect(messages.saved).toHaveLength(0)
  })
})
