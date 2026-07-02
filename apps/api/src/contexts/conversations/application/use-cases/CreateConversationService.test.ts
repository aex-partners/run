import { describe, it, expect } from 'vitest'
import { CreateConversationService } from '@/contexts/conversations/application/use-cases/CreateConversationService'
import { ConversationRepository } from '@/contexts/conversations/application/ports/out/ConversationRepository'
import { ConversationMemberRepository } from '@/contexts/conversations/application/ports/out/ConversationMemberRepository'
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
  nextId(): ConversationId {
    this.seq += 1
    return ConversationId.of(`conv-${this.seq}`)
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
    return null
  }
}

class FakeMemberRepo implements ConversationMemberRepository {
  readonly added: { conversationId: string; members: ConversationMember[] }[] = []
  async findMember(): Promise<ConversationMember | null> {
    return null
  }
  async listMemberIds(): Promise<string[]> {
    return []
  }
  async add(conversationId: ConversationId, members: readonly ConversationMember[]): Promise<void> {
    this.added.push({ conversationId: conversationId.value, members: [...members] })
  }
  async save(): Promise<void> {}
}

class RecordingPublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.events.push(...events)
  }
}

describe('CreateConversationService', () => {
  it('creates a channel with the creator plus distinct members, saves, and publishes ConversationCreated', async () => {
    const conversations = new FakeConversationRepo()
    const members = new FakeMemberRepo()
    const events = new RecordingPublisher()
    const service = new CreateConversationService(conversations, members, events, fixedClock(NOW))

    const res = await service.execute({
      creatorId: 'creator',
      name: 'Team',
      type: 'channel',
      memberIds: ['bob', 'carol'],
    })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.id).toBe('conv-1')
    expect(res.value.name).toBe('Team')
    expect(res.value.type).toBe('channel')
    expect(conversations.saved).toHaveLength(1)
    // Member rows persisted: creator first, then the distinct members.
    expect(members.added).toHaveLength(1)
    expect(members.added[0].members.map((m) => m.userId)).toEqual(['creator', 'bob', 'carol'])
    expect(events.events.map((e) => e.name)).toContain('conversations.ConversationCreated')
  })

  it('defaults a missing name to null and dedupes the creator out of memberIds', async () => {
    const conversations = new FakeConversationRepo()
    const members = new FakeMemberRepo()
    const service = new CreateConversationService(conversations, members, new RecordingPublisher(), fixedClock(NOW))

    const res = await service.execute({
      creatorId: 'creator',
      type: 'channel',
      memberIds: ['creator', 'bob', 'bob'],
    })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.name).toBeNull()
    // creator appears once; duplicate bob collapsed.
    expect(members.added[0].members.map((m) => m.userId)).toEqual(['creator', 'bob'])
  })
})
