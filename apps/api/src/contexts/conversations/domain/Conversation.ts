import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { Result, ok, fail } from '@/shared/kernel/Result'
import { ConversationId } from '@/contexts/conversations/domain/ids'
import { ConversationType } from '@/contexts/conversations/domain/ConversationType'
import { ConversationMember } from '@/contexts/conversations/domain/ConversationMember'
import { ConversationCreated } from '@/contexts/conversations/domain/events/ConversationCreated'
import { MemberAdded } from '@/contexts/conversations/domain/events/MemberAdded'

interface ConversationProps {
  name: string | null
  type: ConversationType
  agentId: string | null
  sessionId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface RehydrateConversationInput {
  id: ConversationId
  name: string | null
  type: ConversationType
  agentId: string | null
  sessionId: string | null
  members: ConversationMember[]
  createdAt: Date
  updatedAt: Date
}

// AGGREGATE ROOT. Owns the conversation's scalar identity (name/type/agent) and
// its membership set. Per-member personal state (read cursor, pinned/favorite/
// muted) lives on each ConversationMember. Message history is a separate
// aggregate referenced by id — a conversation does not load its messages.
export class Conversation extends AggregateRoot<ConversationId> {
  private constructor(
    id: ConversationId,
    private props: ConversationProps,
    private _members: ConversationMember[],
  ) {
    super(id)
  }

  // General factory (the `create` procedure): a conversation with its creator as
  // the first member, plus any additional distinct members.
  static create(input: {
    id: ConversationId
    name: string | null
    type: ConversationType
    creatorId: string
    memberIds: readonly string[]
    now: Date
  }): Conversation {
    const members = [ConversationMember.create(input.creatorId, input.now)]
    for (const uid of input.memberIds) {
      if (uid !== input.creatorId && !members.some((m) => m.userId === uid)) {
        members.push(ConversationMember.create(uid, input.now))
      }
    }
    const conv = new Conversation(
      input.id,
      {
        name: input.name,
        type: input.type,
        agentId: null,
        sessionId: null,
        createdAt: input.now,
        updatedAt: input.now,
      },
      members,
    )
    conv.addEvent(new ConversationCreated(input.id.value, input.type, null, input.now))
    return conv
  }

  // DM factory: a 1:1 direct message between two distinct users. The id is the
  // deterministic pair id (see DmConversationPolicy) so concurrent creates dedupe.
  static createDm(input: { id: ConversationId; userA: string; userB: string; now: Date }): Conversation {
    const conv = new Conversation(
      input.id,
      { name: null, type: 'dm', agentId: null, sessionId: null, createdAt: input.now, updatedAt: input.now },
      [ConversationMember.create(input.userA, input.now), ConversationMember.create(input.userB, input.now)],
    )
    conv.addEvent(new ConversationCreated(input.id.value, 'dm', null, input.now))
    return conv
  }

  // Eric factory: a private AI conversation for one user, bound to an agent.
  static createEric(input: { id: ConversationId; agentId: string; userId: string; now: Date }): Conversation {
    const conv = new Conversation(
      input.id,
      { name: 'Eric', type: 'ai', agentId: input.agentId, sessionId: null, createdAt: input.now, updatedAt: input.now },
      [ConversationMember.create(input.userId, input.now)],
    )
    conv.addEvent(new ConversationCreated(input.id.value, 'ai', input.agentId, input.now))
    return conv
  }

  static rehydrate(input: RehydrateConversationInput): Conversation {
    return new Conversation(
      input.id,
      {
        name: input.name,
        type: input.type,
        agentId: input.agentId,
        sessionId: input.sessionId,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
      },
      input.members,
    )
  }

  get name(): string | null {
    return this.props.name
  }

  get type(): ConversationType {
    return this.props.type
  }

  get agentId(): string | null {
    return this.props.agentId
  }

  get sessionId(): string | null {
    return this.props.sessionId
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  get updatedAt(): Date {
    return this.props.updatedAt
  }

  members(): readonly ConversationMember[] {
    return this._members
  }

  memberIds(): string[] {
    return this._members.map((m) => m.userId)
  }

  member(userId: string): ConversationMember | undefined {
    return this._members.find((m) => m.userId === userId)
  }

  isMember(userId: string): boolean {
    return this._members.some((m) => m.userId === userId)
  }

  // Idempotent: re-adding an existing member is a no-op (records no event).
  addMember(userId: string, now: Date): Result<ConversationMember | null> {
    if (this.isMember(userId)) return ok(null)
    const member = ConversationMember.create(userId, now)
    this._members.push(member)
    this.props.updatedAt = now
    this.addEvent(new MemberAdded(this.id.value, userId, now))
    return ok(member)
  }

  rename(name: string, now: Date): Result<void> {
    const trimmed = name.trim()
    if (trimmed.length < 1) return fail('Conversation: name is required')
    this.props.name = trimmed
    this.props.updatedAt = now
    return ok(undefined)
  }

  setAgent(agentId: string | null, now: Date): void {
    this.props.agentId = agentId
    this.props.updatedAt = now
  }
}
