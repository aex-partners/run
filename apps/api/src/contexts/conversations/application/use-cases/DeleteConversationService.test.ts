import { describe, it, expect } from 'vitest'
import { DeleteConversationService } from '@/contexts/conversations/application/use-cases/DeleteConversationService'
import { ConversationRepository } from '@/contexts/conversations/application/ports/out/ConversationRepository'
import { ConversationMemberRepository } from '@/contexts/conversations/application/ports/out/ConversationMemberRepository'
import { Conversation } from '@/contexts/conversations/domain/Conversation'
import { ConversationMember } from '@/contexts/conversations/domain/ConversationMember'
import { ConversationId } from '@/contexts/conversations/domain/ids'

const NOW = new Date('2026-01-01T00:00:00Z')

class FakeConversationRepo implements ConversationRepository {
  readonly deleted: string[] = []
  nextId(): ConversationId {
    return ConversationId.of('conv-x')
  }
  async findById(): Promise<Conversation | null> {
    return null
  }
  async exists(): Promise<boolean> {
    return false
  }
  async save(): Promise<void> {}
  async saveIfAbsent(): Promise<void> {}
  async delete(id: ConversationId): Promise<void> {
    this.deleted.push(id.value)
  }
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

describe('DeleteConversationService', () => {
  it('hard-deletes the conversation when the actor is a member', async () => {
    const conversations = new FakeConversationRepo()
    const members = new FakeMemberRepo({ c1: ['actor'] })
    const service = new DeleteConversationService(conversations, members)

    const res = await service.execute({ id: 'c1', actorId: 'actor' })

    expect(res.ok).toBe(true)
    expect(conversations.deleted).toEqual(['c1'])
  })

  it('blocks a non-member and does not delete (anti-IDOR)', async () => {
    const conversations = new FakeConversationRepo()
    const members = new FakeMemberRepo({ c1: ['someone-else'] })
    const service = new DeleteConversationService(conversations, members)

    const res = await service.execute({ id: 'c1', actorId: 'actor' })

    expect(res.ok).toBe(false)
    expect(conversations.deleted).toHaveLength(0)
  })
})
