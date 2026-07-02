import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { UpdateAgent, UpdateAgentCommand } from '@/contexts/agents/application/ports/in/UpdateAgent'
import { AgentRepository } from '@/contexts/agents/application/ports/out/AgentRepository'
import { AgentView } from '@/contexts/agents/application/queries/AgentView'
import { AgentMapper } from '@/contexts/agents/application/mappers/AgentMapper'
import { AgentId } from '@/contexts/agents/domain/AgentId'
import { AgentSlug } from '@/contexts/agents/domain/AgentSlug'

// agents.update. Loads the aggregate, regenerates + uniqueness-checks the slug
// when the name changes, applies the partial patch, persists and publishes.
export class UpdateAgentService implements UpdateAgent {
  constructor(
    private readonly agents: AgentRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: UpdateAgentCommand): Promise<Result<AgentView>> {
    const agent = await this.agents.findById(AgentId.of(cmd.id))
    if (!agent) return fail('Agent not found')

    let slug: AgentSlug | undefined
    if (cmd.name !== undefined) {
      slug = AgentSlug.fromName(cmd.name)
      if (await this.agents.existsBySlug(slug, agent.id)) {
        return fail(`Agent: slug "${slug.value}" already in use`)
      }
    }

    const updated = agent.update(
      {
        name: cmd.name,
        slug,
        description: cmd.description,
        avatar: cmd.avatar,
        systemPrompt: cmd.systemPrompt,
        modelId: cmd.modelId,
        skillIds: cmd.skillIds,
        toolIds: cmd.toolIds,
      },
      this.clock.now(),
    )
    if (!updated.ok) return fail(updated.error)

    await this.agents.save(agent)
    await this.events.publish(agent.pullEvents())
    return ok(AgentMapper.toView(agent))
  }
}
