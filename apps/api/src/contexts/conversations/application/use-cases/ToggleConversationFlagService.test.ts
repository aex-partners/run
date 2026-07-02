import { describe, it, expect } from 'vitest'
import { ToggleConversationFlagService } from '@/contexts/conversations/application/use-cases/ToggleConversationFlagService'
import { ConversationMemberRepository } from '@/contexts/conversations/application/ports/out/ConversationMemberRepository'
import { ConversationMember } from '@/contexts/conversations/domain/ConversationMember'
import { ConversationId } from '@/contexts/conversations/domain/ids'

const NOW = new Date('2026-01-01T00:00:00Z')

// Returns the SAME member instance each call so toggles persist within a test.
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

describe('ToggleConversationFlagService', () => {
  it('toggles the pinned flag on for a member and saves', async () => {
    const member = ConversationMember.create('me', NOW)
    const members = new FakeMemberRepo({ 'c1:me': member })
    const service = new ToggleConversationFlagService(members)

    const res = await service.execute({ id: 'c1', userId: 'me', flag: 'pinned' })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value).toEqual({ flag: 'pinned', value: true })
    expect(member.pinned).toBe(true)
    expect(members.saved).toHaveLength(1)
  })

  it('toggles the favorite flag', async () => {
    const member = ConversationMember.create('me', NOW)
    const members = new FakeMemberRepo({ 'c1:me': member })
    const service = new ToggleConversationFlagService(members)

    const res = await service.execute({ id: 'c1', userId: 'me', flag: 'favorite' })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value).toEqual({ flag: 'favorite', value: true })
    expect(member.favorite).toBe(true)
  })

  it('toggles the muted flag back off on the second call', async () => {
    const member = ConversationMember.create('me', NOW)
    const members = new FakeMemberRepo({ 'c1:me': member })
    const service = new ToggleConversationFlagService(members)

    const first = await service.execute({ id: 'c1', userId: 'me', flag: 'muted' })
    const second = await service.execute({ id: 'c1', userId: 'me', flag: 'muted' })

    expect(first.ok && first.value.value).toBe(true)
    expect(second.ok && second.value.value).toBe(false)
    expect(member.muted).toBe(false)
  })

  it('fails when no membership row exists', async () => {
    const members = new FakeMemberRepo({})
    const service = new ToggleConversationFlagService(members)

    const res = await service.execute({ id: 'c1', userId: 'stranger', flag: 'pinned' })

    expect(res.ok).toBe(false)
    expect(members.saved).toHaveLength(0)
  })
})
