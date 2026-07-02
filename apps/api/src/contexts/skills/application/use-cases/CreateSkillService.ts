import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { CreateSkill, CreateSkillCommand } from '@/contexts/skills/application/ports/in/CreateSkill'
import { SkillRepository } from '@/contexts/skills/application/ports/out/SkillRepository'
import { Skill } from '@/contexts/skills/domain/Skill'
import { Guardrails } from '@/contexts/skills/domain/Guardrails'
import { slugTakenError } from '@/contexts/skills/domain/Slug'

// Application service. Validates the guardrails VO, builds the aggregate (name /
// systemPrompt rules + slug derivation live in the factory), enforces the
// slug-uniqueness invariant via the out-port, persists, publishes events. Depends
// ONLY on ports.
export class CreateSkillService implements CreateSkill {
  constructor(
    private readonly skills: SkillRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: CreateSkillCommand): Promise<Result<{ id: string; slug: string }>> {
    const guardrails = Guardrails.of(cmd.guardrails ?? {})
    if (!guardrails.ok) return fail(guardrails.error)

    const id = this.skills.nextId()
    const skill = Skill.create({
      id,
      name: cmd.name,
      description: cmd.description ?? null,
      systemPrompt: cmd.systemPrompt,
      toolIds: cmd.toolIds ?? [],
      systemToolNames: cmd.systemToolNames ?? [],
      guardrails: guardrails.value,
      createdBy: cmd.createdBy,
      now: this.clock.now(),
    })
    if (!skill.ok) return fail(skill.error)

    if (await this.skills.existsBySlug(skill.value.slug)) {
      return fail(slugTakenError(skill.value.slug))
    }

    await this.skills.save(skill.value)
    await this.events.publish(skill.value.pullEvents())
    return ok({ id: id.value, slug: skill.value.slug })
  }
}
