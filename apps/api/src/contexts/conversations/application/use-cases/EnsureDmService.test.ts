import { describe, it, expect } from 'vitest'
import { EnsureDmService } from '@/contexts/conversations/application/use-cases/EnsureDmService'
import { ConversationRepository } from '@/contexts/conversations/application/ports/out/ConversationRepository'
import { ConversationMemberRepository } from '@/contexts/conversations/application/ports/out/ConversationMemberRepository'
import { Conversation } from '@/contexts/conversations/domain/Conversation'
import { ConversationMember } from '@/contexts/conversations/domain/ConversationMember'
import { ConversationId } from '@/contexts/conversations/domain/ids'
import { DmConversationPolicy } from '@/contexts/conversations/domain/services/DmConversationPolicy'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2026-01-01T00:00:00Z')
const fixedClock = (now: Date): Clock => ({ now: () => now })

class FakeConversationRepo implements ConversationRepository {
  private seq = 0
  readonly savedIfAbsent: Conversation[] = []
  dmBetween: ConversationId | null = null
  nextId(): ConversationId {
    this.seq += 1
    return ConversationId.of(`c-${this.seq}`)
  }
  async findById(): Promise<Conversation | null> {
    return null
  }
  async exists(): Promise<boolean> {
    return false
  }
  async save(): Promise<void> {}
  async saveIfAbsent(conversation: Conversation): Promise<void> {
    this.savedIfAbsent.push(conversation)
  }
  async delete(): Promise<void> {}
  async findDmBetween(): Promise<ConversationId | null> {
    return this.dmBetween
  }
  async findEricConversation(): Promise<ConversationId | null> {
    return null
  }
}

class FakeMemberRepo implements ConversationMemberRepository {
  readonly added: { conversationId: string; members: readonly ConversationMember[] }[] = []
  async findMember(): Promise<ConversationMember | null> {
    return null
  }
  async listMemberIds(): Promise<string[]> {
    return []
  }
  async add(conversationId: ConversationId, members: readonly ConversationMember[]): Promise<void> {
    this.added.push({ conversationId: conversationId.value, members })
  }
  async save(): Promise<void> {}
}

class RecordingPublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.events.push(...events)
  }
}

const setup = () => {
  const conversations = new FakeConversationRepo()
  const members = new FakeMemberRepo()
  const events = new RecordingPublisher()
  const service = new EnsureDmService(conversations, members, events, fixedClock(NOW))
  return { conversations, members, events, service }
}

describe('EnsureDmService', () => {
  it('rejects DMing yourself', async () => {
    const { conversations, service } = setup()
    const res = await service.execute({ userId: 'u1', peerUserId: 'u1' })
    expect(res.ok).toBe(false)
    expect(conversations.savedIfAbsent).toHaveLength(0)
  })

  it('returns the existing DM without creating a new one', async () => {
    const { conversations, service } = setup()
    conversations.dmBetween = ConversationId.of('existing-dm')
    const res = await service.execute({ userId: 'u1', peerUserId: 'u2' })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.id).toBe('existing-dm')
    expect(conversations.savedIfAbsent).toHaveLength(0)
  })

  it('creates the DM under the deterministic pair id, adds members and publishes', async () => {
    const { conversations, members, events, service } = setup()
    const res = await service.execute({ userId: 'u1', peerUserId: 'u2' })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const expectedId = DmConversationPolicy.deterministicId('u1', 'u2')
    expect(expectedId.ok).toBe(true)
    if (!expectedId.ok) return
    expect(res.value.id).toBe(expectedId.value.value)
    expect(conversations.savedIfAbsent).toHaveLength(1)
    expect(members.added[0].members.map((m) => m.userId)).toEqual(['u1', 'u2'])
    expect(events.events.map((e) => e.name)).toContain('conversations.ConversationCreated')
  })

  it('converges on the same id regardless of caller/peer order', async () => {
    const a = setup()
    const b = setup()
    const r1 = await a.service.execute({ userId: 'u1', peerUserId: 'u2' })
    const r2 = await b.service.execute({ userId: 'u2', peerUserId: 'u1' })
    expect(r1.ok && r2.ok).toBe(true)
    if (!r1.ok || !r2.ok) return
    expect(r1.value.id).toBe(r2.value.id)
  })
})
