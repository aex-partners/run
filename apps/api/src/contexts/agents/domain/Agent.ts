import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { Result, ok, fail } from '@/shared/kernel/Result'
import { AgentId } from '@/contexts/agents/domain/AgentId'
import { AgentSlug } from '@/contexts/agents/domain/AgentSlug'
import { AgentCreated } from '@/contexts/agents/domain/events/AgentCreated'
import { AgentUpdated } from '@/contexts/agents/domain/events/AgentUpdated'
import { AgentDeleted } from '@/contexts/agents/domain/events/AgentDeleted'

// Snapshot used by the mapper to rehydrate an agent from a persisted row. No
// validation runs on this path (the row is trusted) and no events are recorded.
export interface AgentSnapshot {
  id: string
  name: string
  slug: string
  description: string | null
  avatar: string | null
  systemPrompt: string
  modelId: string | null
  skillIds: string[]
  toolIds: string[]
  isSystem: boolean
  userId: string | null
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateAgentProps {
  id: AgentId
  name: string
  slug: AgentSlug
  description?: string | null
  avatar?: string | null
  systemPrompt: string
  modelId?: string | null
  skillIds?: string[]
  toolIds?: string[]
  isSystem?: boolean
  createdBy: string | null
  now: Date
}

// Partial patch for an edit. The service supplies a regenerated `slug` whenever
// `name` is present (slug tracks the display name).
export interface UpdateAgentProps {
  name?: string
  slug?: AgentSlug
  description?: string | null
  avatar?: string | null
  systemPrompt?: string
  modelId?: string | null
  skillIds?: string[]
  toolIds?: string[]
}

// AGGREGATE ROOT of the agents context. Guards what a VALID AI agent definition
// is: a non-empty name and system prompt, an immutable system-agent flag (system
// agents are not deletable), the set of skill/tool ids it composes, and the
// optional backing "bot" user that lets it act as a first-class task actor. Slug
// FORMAT lives in AgentSlug; slug UNIQUENESS is enforced at the boundary by the
// repository.
export class Agent extends AggregateRoot<AgentId> {
  private constructor(
    id: AgentId,
    private _name: string,
    private _slug: AgentSlug,
    private _description: string | null,
    private _avatar: string | null,
    private _systemPrompt: string,
    private _modelId: string | null,
    private _skillIds: string[],
    private _toolIds: string[],
    private readonly _isSystem: boolean,
    private _userId: string | null,
    private readonly _createdBy: string | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super(id)
  }

  static create(props: CreateAgentProps): Result<Agent> {
    const name = props.name.trim()
    if (name.length < 1) return fail('Agent: name is required')
    const systemPrompt = props.systemPrompt.trim()
    if (systemPrompt.length < 1) return fail('Agent: systemPrompt is required')

    const agent = new Agent(
      props.id,
      name,
      props.slug,
      props.description ?? null,
      props.avatar ?? null,
      systemPrompt,
      props.modelId ?? null,
      [...(props.skillIds ?? [])],
      [...(props.toolIds ?? [])],
      props.isSystem ?? false,
      null,
      props.createdBy ?? null,
      props.now,
      props.now,
    )
    agent.addEvent(new AgentCreated(props.id.value, name, props.slug.value, props.now))
    return ok(agent)
  }

  static rehydrate(s: AgentSnapshot): Agent {
    return new Agent(
      AgentId.of(s.id),
      s.name,
      AgentSlug.of(s.slug),
      s.description,
      s.avatar,
      s.systemPrompt,
      s.modelId,
      [...s.skillIds],
      [...s.toolIds],
      s.isSystem,
      s.userId,
      s.createdBy,
      s.createdAt,
      s.updatedAt,
    )
  }

  // Partial edit mirroring agents.update: only provided fields change; when the
  // name changes the caller passes the regenerated slug.
  update(props: UpdateAgentProps, now: Date): Result<void> {
    if (props.name !== undefined) {
      const name = props.name.trim()
      if (name.length < 1) return fail('Agent: name is required')
      this._name = name
      if (props.slug) this._slug = props.slug
    }
    if (props.description !== undefined) this._description = props.description
    if (props.avatar !== undefined) this._avatar = props.avatar
    if (props.systemPrompt !== undefined) {
      const systemPrompt = props.systemPrompt.trim()
      if (systemPrompt.length < 1) return fail('Agent: systemPrompt is required')
      this._systemPrompt = systemPrompt
    }
    if (props.modelId !== undefined) this._modelId = props.modelId
    if (props.skillIds !== undefined) this._skillIds = [...props.skillIds]
    if (props.toolIds !== undefined) this._toolIds = [...props.toolIds]

    this._updatedAt = now
    this.addEvent(new AgentUpdated(this.id.value, now))
    return ok(undefined)
  }

  // Links the backing bot user (created in the identity context via an ACL
  // out-port) so this agent can author messages and own tasks.
  linkBotUser(userId: string): void {
    this._userId = userId
  }

  // isSystem guard: built-in/system agents must not be deleted.
  ensureDeletable(): Result<void> {
    if (this._isSystem) return fail('Cannot delete system agent')
    return ok(undefined)
  }

  markDeleted(now: Date): void {
    this.addEvent(new AgentDeleted(this.id.value, now))
  }

  get name(): string {
    return this._name
  }
  get slug(): AgentSlug {
    return this._slug
  }
  get description(): string | null {
    return this._description
  }
  get avatar(): string | null {
    return this._avatar
  }
  get systemPrompt(): string {
    return this._systemPrompt
  }
  get modelId(): string | null {
    return this._modelId
  }
  get skillIds(): readonly string[] {
    return this._skillIds
  }
  get toolIds(): readonly string[] {
    return this._toolIds
  }
  get isSystem(): boolean {
    return this._isSystem
  }
  get userId(): string | null {
    return this._userId
  }
  get createdBy(): string | null {
    return this._createdBy
  }
  get createdAt(): Date {
    return this._createdAt
  }
  get updatedAt(): Date {
    return this._updatedAt
  }
}
