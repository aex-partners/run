import { describe, it, expect } from 'vitest'
import { AddMemberService } from '@/contexts/conversations/application/use-cases/AddMemberService'
import { ConversationMemberRepository } from '@/contexts/conversations/application/ports/out/ConversationMemberRepository'
import { ConversationMember } from '@/contexts/conversations/domain/ConversationMember'
import { ConversationId } from '@/contexts/conversations/domain/ids'
import { Clock } from '@/shared/kernel/Clock'

const NOW = new Date('2026-01-01T00:00:00Z')
const fixedClock = (now: Date): Clock => ({ now: () => now })

// membership[conversationId] = list of member userIds
class FakeMemberRepo implements ConversationMemberRepository {
  readonly added: { conversationId: string; members: ConversationMember[] }[] = []
  constructor(private membership: Record<string, string[]>) {}
  async findMember(conversationId: ConversationId, userId: string): Promise<ConversationMember | null> {
    const ids = this.membership[conversationId.value] ?? []
    return ids.includes(userId) ? ConversationMember.create(userId, NOW) : null
  }
  async listMemberIds(conversationId: ConversationId): Promise<string[]> {
    return [...(this.membership[conversationId.value] ?? [])]
  }
  async add(conversationId: ConversationId, members: readonly ConversationMember[]): Promise<void> {
    this.added.push({ conversationId: conversationId.value, members: [...members] })
  }
  async save(): Promise<void> {}
}

describe('AddMemberService', () => {
  it('adds a user when the actor is already a member', async () => {
    const members = new FakeMemberRepo({ c1: ['actor'] })
    const service = new AddMemberService(members, fixedClock(NOW))

    const res = await service.execute({ conversationId: 'c1', actorId: 'actor', userId: 'newbie' })

    expect(res.ok).toBe(true)
    expect(members.added).toHaveLength(1)
    expect(members.added[0].conversationId).toBe('c1')
    expect(members.added[0].members.map((m) => m.userId)).toEqual(['newbie'])
    expect(members.added[0].members[0].joinedAt).toEqual(NOW)
  })

  it('blocks a non-member actor and does not add (anti-IDOR)', async () => {
    const members = new FakeMemberRepo({ c1: ['someone-else'] })
    const service = new AddMemberService(members, fixedClock(NOW))

    const res = await service.execute({ conversationId: 'c1', actorId: 'actor', userId: 'newbie' })

    expect(res.ok).toBe(false)
    expect(members.added).toHaveLength(0)
  })
})
