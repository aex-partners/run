import { describe, it, expect } from 'vitest'
import { EnsureEricService } from '@/contexts/conversations/application/use-cases/EnsureEricService'
import { ConversationRepository } from '@/contexts/conversations/application/ports/out/ConversationRepository'
import { ConversationMemberRepository } from '@/contexts/conversations/application/ports/out/ConversationMemberRepository'
import { AgentDirectory } from '@/contexts/conversations/application/ports/out/AgentDirectory'
import { Conversation } from '@/contexts/conversations/domain/Conversation'
import { ConversationMember } from '@/contexts/conversations/domain/ConversationMember'
import { ConversationId } from '@/contexts/conversations/domain/ids'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2026-01-01T00:00:00Z')
const fixedClock = (now: Date): Clock => ({ now: () => now })

class FakeConversationRepo implements ConversationRepository {
  private seq = 0
  readonly saved: Conversation[] = []
  eric: ConversationId | null = null
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
  async save(conversation: Conversation): Promise<void> {
    this.saved.push(conversation)
  }
  async saveIfAbsent(): Promise<void> {}
  async delete(): Promise<void> {}
  async findDmBetween(): Promise<ConversationId | null> {
    return null
  }
  async findEricConversation(): Promise<ConversationId | null> {
    return this.eric
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

class FakeAgentDirectory implements AgentDirectory {
  constructor(private id: string | null) {}
  async ericAgentId(): Promise<string | null> {
    return this.id
  }
}

class RecordingPublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.events.push(...events)
  }
}

const setup = (ericAgentId: string | null) => {
  const conversations = new FakeConversationRepo()
  const members = new FakeMemberRepo()
  const agents = new FakeAgentDirectory(ericAgentId)
  const events = new RecordingPublisher()
  const service = new EnsureEricService(conversations, members, agents, events, fixedClock(NOW))
  return { conversations, members, events, service }
}

describe('EnsureEricService', () => {
  it('fails when no Eric agent exists', async () => {
    const { conversations, service } = setup(null)
    const res = await service.execute({ userId: 'u1' })
    expect(res.ok).toBe(false)
    expect(conversations.saved).toHaveLength(0)
  })

  it('returns the existing Eric conversation without creating a new one', async () => {
    const { conversations, service } = setup('agent-eric')
    conversations.eric = ConversationId.of('eric-existing')
    const res = await service.execute({ userId: 'u1' })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.id).toBe('eric-existing')
    expect(conversations.saved).toHaveLength(0)
  })

  it('creates the AI conversation bound to the Eric agent, adds the single member and publishes', async () => {
    const { conversations, members, events, service } = setup('agent-eric')
    const res = await service.execute({ userId: 'u1' })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.id).toBe('c-1')
    expect(conversations.saved).toHaveLength(1)
    expect(conversations.saved[0].type).toBe('ai')
    expect(conversations.saved[0].agentId).toBe('agent-eric')
    expect(members.added[0].members.map((m) => m.userId)).toEqual(['u1'])
    expect(events.events.map((e) => e.name)).toContain('conversations.ConversationCreated')
  })
})
