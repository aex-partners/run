import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DeleteAgent, DeleteAgentCommand } from '@/contexts/agents/application/ports/in/DeleteAgent'
import { AgentRepository } from '@/contexts/agents/application/ports/out/AgentRepository'
import { AgentId } from '@/contexts/agents/domain/AgentId'

// agents.delete. System agents are protected (isSystem guard); deleting an
// unknown agent is a no-op success, mirroring the source's delete semantics.
export class DeleteAgentService implements DeleteAgent {
  constructor(
    private readonly agents: AgentRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: DeleteAgentCommand): Promise<Result<{ success: true }>> {
    const agent = await this.agents.findById(AgentId.of(cmd.id))
    if (!agent) return ok({ success: true })

    const deletable = agent.ensureDeletable()
    if (!deletable.ok) return fail(deletable.error)

    agent.markDeleted(this.clock.now())
    await this.agents.delete(agent.id)
    await this.events.publish(agent.pullEvents())
    return ok({ success: true })
  }
}
