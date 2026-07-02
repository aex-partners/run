import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { UpdateSkill, UpdateSkillCommand } from '@/contexts/skills/application/ports/in/UpdateSkill'
import { SkillRepository } from '@/contexts/skills/application/ports/out/SkillRepository'
import { SkillId } from '@/contexts/skills/domain/ids'
import { Guardrails } from '@/contexts/skills/domain/Guardrails'
import { slugTakenError } from '@/contexts/skills/domain/Slug'

// Application service. Loads the aggregate, validates the guardrails VO (only when
// supplied), applies the pure partial update, and — when renaming re-derived the
// slug — re-checks uniqueness against every OTHER skill before persisting.
export class UpdateSkillService implements UpdateSkill {
  constructor(
    private readonly skills: SkillRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: UpdateSkillCommand): Promise<Result<{ id: string }>> {
    const skill = await this.skills.findById(SkillId.of(cmd.id))
    if (!skill) return fail('UpdateSkill: skill not found')

    let guardrails: Guardrails | undefined
    if (cmd.guardrails !== undefined) {
      const parsed = Guardrails.of(cmd.guardrails)
      if (!parsed.ok) return fail(parsed.error)
      guardrails = parsed.value
    }

    const updated = skill.update(
      {
        name: cmd.name,
        description: cmd.description,
        systemPrompt: cmd.systemPrompt,
        toolIds: cmd.toolIds,
        systemToolNames: cmd.systemToolNames,
        guardrails,
      },
      this.clock.now(),
    )
    if (!updated.ok) return fail(updated.error)

    if (skill.nameChanged() && (await this.skills.existsBySlug(skill.slug, skill.id.value))) {
      return fail(slugTakenError(skill.slug))
    }

    await this.skills.save(skill)
    await this.events.publish(skill.pullEvents())
    return ok({ id: cmd.id })
  }
}
