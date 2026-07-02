import { describe, it, expect } from 'vitest'
import { SetConversationAgentService } from '@/contexts/conversations/application/use-cases/SetConversationAgentService'
import { ConversationRepository } from '@/contexts/conversations/application/ports/out/ConversationRepository'
import { ConversationMemberRepository } from '@/contexts/conversations/application/ports/out/ConversationMemberRepository'
import { Conversation } from '@/contexts/conversations/domain/Conversation'
import { ConversationMember } from '@/contexts/conversations/domain/ConversationMember'
import { ConversationId } from '@/contexts/conversations/domain/ids'
import { Clock } from '@/shared/kernel/Clock'

const NOW = new Date('2026-01-01T00:00:00Z')
const fixedClock = (now: Date): Clock => ({ now: () => now })

const mkConversation = (id: string, agentId: string | null): Conversation =>
  Conversation.rehydrate({
    id: ConversationId.of(id),
    name: 'Chat',
    type: 'ai',
    agentId,
    sessionId: null,
    members: [],
    createdAt: NOW,
    updatedAt: NOW,
  })

class FakeConversationRepo implements ConversationRepository {
  readonly saved: Conversation[] = []
  constructor(private store: Map<string, Conversation>) {}
  nextId(): ConversationId {
    return ConversationId.of('conv-x')
  }
  async findById(id: ConversationId): Promise<Conversation | null> {
    return this.store.get(id.value) ?? null
  }
  async exists(): Promise<boolean> {
    return false
  }
  async save(conversation: Conversation): Promise<void> {
    this.saved.push(conversation)
  }
  async saveIfAbsent(): Promise<void> {}
  async delete(): Promise<void> {}
  async findDmBetween(): Promise<ConversationId | null> {
    return null
  }
  async findEricConversation(): Promise<ConversationId | null> {
    return null
  }
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

describe('SetConversationAgentService', () => {
  it('binds the agent for a member, saves, and echoes the updated view', async () => {
    const conv = mkConversation('c1', null)
    const conversations = new FakeConversationRepo(new Map([['c1', conv]]))
    const members = new FakeMemberRepo({ c1: ['actor'] })
    const service = new SetConversationAgentService(conversations, members, fixedClock(NOW))

    const res = await service.execute({ conversationId: 'c1', actorId: 'actor', agentId: 'agent-1' })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.agentId).toBe('agent-1')
    expect(conversations.saved).toHaveLength(1)
    expect(conv.agentId).toBe('agent-1')
  })

  it('clears the agent when passed null', async () => {
    const conv = mkConversation('c1', 'agent-1')
    const conversations = new FakeConversationRepo(new Map([['c1', conv]]))
    const members = new FakeMemberRepo({ c1: ['actor'] })
    const service = new SetConversationAgentService(conversations, members, fixedClock(NOW))

    const res = await service.execute({ conversationId: 'c1', actorId: 'actor', agentId: null })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.agentId).toBeNull()
  })

  it('blocks a non-member and does not save', async () => {
    const conv = mkConversation('c1', null)
    const conversations = new FakeConversationRepo(new Map([['c1', conv]]))
    const members = new FakeMemberRepo({ c1: ['someone'] })
    const service = new SetConversationAgentService(conversations, members, fixedClock(NOW))

    const res = await service.execute({ conversationId: 'c1', actorId: 'actor', agentId: 'agent-1' })

    expect(res.ok).toBe(false)
    expect(conversations.saved).toHaveLength(0)
  })

  it('fails when the member exists but the conversation row is missing', async () => {
    const conversations = new FakeConversationRepo(new Map())
    const members = new FakeMemberRepo({ c1: ['actor'] })
    const service = new SetConversationAgentService(conversations, members, fixedClock(NOW))

    const res = await service.execute({ conversationId: 'c1', actorId: 'actor', agentId: 'agent-1' })

    expect(res.ok).toBe(false)
    expect(conversations.saved).toHaveLength(0)
  })
})
