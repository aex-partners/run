import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { Result, ok, fail } from '@/shared/kernel/Result'
import { SkillId } from '@/contexts/skills/domain/ids'
import { slugify } from '@/contexts/skills/domain/Slug'
import { Guardrails } from '@/contexts/skills/domain/Guardrails'
import { SkillCreated } from '@/contexts/skills/domain/events/SkillCreated'
import { SkillUpdated } from '@/contexts/skills/domain/events/SkillUpdated'
import { SkillDeleted } from '@/contexts/skills/domain/events/SkillDeleted'

interface SkillProps {
  name: string
  slug: string
  description: string | null
  systemPrompt: string
  toolIds: string[]
  systemToolNames: string[]
  guardrails: Guardrails
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateSkillInput {
  id: SkillId
  name: string
  description: string | null
  systemPrompt: string
  toolIds: string[]
  systemToolNames: string[]
  guardrails: Guardrails
  createdBy: string
  now: Date
}

export interface RehydrateSkillInput {
  id: SkillId
  name: string
  slug: string
  description: string | null
  systemPrompt: string
  toolIds: string[]
  systemToolNames: string[]
  guardrails: Guardrails
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface UpdateSkillPatch {
  name?: string
  description?: string | null
  systemPrompt?: string
  toolIds?: string[]
  systemToolNames?: string[]
  guardrails?: Guardrails
}

// PURE list hygiene for tool references: trim, drop empties, dedupe (order kept).
function normalizeRefs(list: string[]): string[] {
  const out: string[] = []
  for (const raw of list) {
    const ref = raw.trim()
    if (ref.length > 0 && !out.includes(ref)) out.push(ref)
  }
  return out
}

// AGGREGATE. A reusable AI skill template: a named, slugged bundle of a system
// prompt, the data-context tools and built-in (system) tool names it grants, and
// the Guardrails that fence the agent running it. Every transition is PURE — it
// validates, mutates in-memory state and records an event; all IO (persistence,
// slug-uniqueness lookup) lives in the use cases and adapters.
export class Skill extends AggregateRoot<SkillId> {
  private constructor(
    id: SkillId,
    private props: SkillProps,
  ) {
    super(id)
  }

  // Factory. Guards the invariants of a valid new skill (name + systemPrompt
  // required, mirroring the source `z.string().min(1)`), derives the slug, and
  // normalizes the tool reference lists.
  static create(input: CreateSkillInput): Result<Skill> {
    const name = input.name.trim()
    if (name.length < 1) return fail('Skill: name is required')

    const systemPrompt = input.systemPrompt.trim()
    if (systemPrompt.length < 1) return fail('Skill: systemPrompt is required')

    const skill = new Skill(input.id, {
      name,
      slug: slugify(name),
      description: input.description,
      systemPrompt,
      toolIds: normalizeRefs(input.toolIds),
      systemToolNames: normalizeRefs(input.systemToolNames),
      guardrails: input.guardrails,
      createdBy: input.createdBy,
      createdAt: input.now,
      updatedAt: input.now,
    })
    skill.addEvent(new SkillCreated(input.id.value, skill.props.slug, input.now))
    return ok(skill)
  }

  // Rehydrate from persistence (no events, no re-validation of stored data).
  static rehydrate(input: RehydrateSkillInput): Skill {
    return new Skill(input.id, {
      name: input.name,
      slug: input.slug,
      description: input.description,
      systemPrompt: input.systemPrompt,
      toolIds: input.toolIds,
      systemToolNames: input.systemToolNames,
      guardrails: input.guardrails,
      createdBy: input.createdBy,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
    })
  }

  get name(): string {
    return this.props.name
  }

  get slug(): string {
    return this.props.slug
  }

  get description(): string | null {
    return this.props.description
  }

  get systemPrompt(): string {
    return this.props.systemPrompt
  }

  get toolIds(): readonly string[] {
    return this.props.toolIds
  }

  get systemToolNames(): readonly string[] {
    return this.props.systemToolNames
  }

  get guardrails(): Guardrails {
    return this.props.guardrails
  }

  get createdBy(): string {
    return this.props.createdBy
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  get updatedAt(): Date {
    return this.props.updatedAt
  }

  // Did this update change the slug? The use case re-checks uniqueness only then.
  nameChanged(): boolean {
    return this._slugDirty
  }
  private _slugDirty = false

  // PURE partial update (source router `update`). Renaming re-derives the slug;
  // an omitted field is left unchanged. Guardrails are swapped whole (the VO is
  // immutable and validated by the caller).
  update(patch: UpdateSkillPatch, now: Date): Result<void> {
    if (patch.name !== undefined) {
      const name = patch.name.trim()
      if (name.length < 1) return fail('Skill: name is required')
      this.props.name = name
      this.props.slug = slugify(name)
      this._slugDirty = true
    }
    if (patch.description !== undefined) this.props.description = patch.description
    if (patch.systemPrompt !== undefined) {
      const systemPrompt = patch.systemPrompt.trim()
      if (systemPrompt.length < 1) return fail('Skill: systemPrompt is required')
      this.props.systemPrompt = systemPrompt
    }
    if (patch.toolIds !== undefined) this.props.toolIds = normalizeRefs(patch.toolIds)
    if (patch.systemToolNames !== undefined) this.props.systemToolNames = normalizeRefs(patch.systemToolNames)
    if (patch.guardrails !== undefined) this.props.guardrails = patch.guardrails

    this.props.updatedAt = now
    this.addEvent(new SkillUpdated(this.id.value, now))
    return ok(undefined)
  }

  // PURE. Records the deletion so the use case can publish it after the row is
  // dropped (source router `delete` is a hard delete).
  markDeleted(now: Date): void {
    this.addEvent(new SkillDeleted(this.id.value, now))
  }
}
