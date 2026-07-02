import { describe, it, expect } from 'vitest'
import { MarkConversationReadService } from '@/contexts/conversations/application/use-cases/MarkConversationReadService'
import { ConversationMemberRepository } from '@/contexts/conversations/application/ports/out/ConversationMemberRepository'
import { ConversationMember } from '@/contexts/conversations/domain/ConversationMember'
import { ConversationId } from '@/contexts/conversations/domain/ids'
import { Clock } from '@/shared/kernel/Clock'

const JOINED = new Date('2025-12-01T00:00:00Z')
const NOW = new Date('2026-01-01T00:00:00Z')
const fixedClock = (now: Date): Clock => ({ now: () => now })

// Returns the SAME member instance each call so we can observe the mutation.
class FakeMemberRepo implements ConversationMemberRepository {
  readonly saved: { conversationId: string; member: ConversationMember }[] = []
  constructor(private members: Record<string, ConversationMember>) {}
  async findMember(conversationId: ConversationId, userId: string): Promise<ConversationMember | null> {
    return this.members[`${conversationId.value}:${userId}`] ?? null
  }
  async listMemberIds(): Promise<string[]> {
    return []
  }
  async add(): Promise<void> {}
  async save(conversationId: ConversationId, member: ConversationMember): Promise<void> {
    this.saved.push({ conversationId: conversationId.value, member })
  }
}

describe('MarkConversationReadService', () => {
  it('advances the caller\'s read cursor and saves the member', async () => {
    const member = ConversationMember.create('me', JOINED)
    const members = new FakeMemberRepo({ 'c1:me': member })
    const service = new MarkConversationReadService(members, fixedClock(NOW))

    const res = await service.execute({ id: 'c1', userId: 'me' })

    expect(res.ok).toBe(true)
    expect(members.saved).toHaveLength(1)
    expect(members.saved[0].conversationId).toBe('c1')
    expect(members.saved[0].member.lastReadAt).toEqual(NOW)
  })

  it('is a no-op for a non-member but still succeeds', async () => {
    const members = new FakeMemberRepo({})
    const service = new MarkConversationReadService(members, fixedClock(NOW))

    const res = await service.execute({ id: 'c1', userId: 'stranger' })

    expect(res.ok).toBe(true)
    expect(members.saved).toHaveLength(0)
  })
})
