import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DeleteSkill, DeleteSkillCommand } from '@/contexts/skills/application/ports/in/DeleteSkill'
import { SkillRepository } from '@/contexts/skills/application/ports/out/SkillRepository'
import { SkillId } from '@/contexts/skills/domain/ids'

// Application service. Loads the aggregate, records the deletion event, drops the
// row (source `delete` is a hard delete), then publishes. Depends ONLY on ports.
export class DeleteSkillService implements DeleteSkill {
  constructor(
    private readonly skills: SkillRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: DeleteSkillCommand): Promise<Result<{ success: true }>> {
    const skill = await this.skills.findById(SkillId.of(cmd.id))
    if (!skill) return fail('DeleteSkill: skill not found')

    skill.markDeleted(this.clock.now())
    await this.skills.delete(skill.id)
    await this.events.publish(skill.pullEvents())
    return ok({ success: true })
  }
}
