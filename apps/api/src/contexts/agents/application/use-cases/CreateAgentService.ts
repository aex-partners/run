import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { CreateAgent, CreateAgentCommand } from '@/contexts/agents/application/ports/in/CreateAgent'
import { AgentRepository } from '@/contexts/agents/application/ports/out/AgentRepository'
import { BotUserProvisioner } from '@/contexts/agents/application/ports/out/BotUserProvisioner'
import { AgentView } from '@/contexts/agents/application/queries/AgentView'
import { AgentMapper } from '@/contexts/agents/application/mappers/AgentMapper'
import { Agent } from '@/contexts/agents/domain/Agent'
import { AgentSlug } from '@/contexts/agents/domain/AgentSlug'

// agents.create. Builds the aggregate (rules live in the factory), enforces slug
// uniqueness via the repository, provisions a backing bot user through the
// identity ACL and links it, then persists and publishes events.
export class CreateAgentService implements CreateAgent {
  constructor(
    private readonly agents: AgentRepository,
    private readonly botUsers: BotUserProvisioner,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: CreateAgentCommand): Promise<Result<AgentView>> {
    const slug = AgentSlug.fromName(cmd.name)
    if (await this.agents.existsBySlug(slug)) {
      return fail(`Agent: slug "${slug.value}" already in use`)
    }

    const now = this.clock.now()
    const id = this.agents.nextId()
    const created = Agent.create({
      id,
      name: cmd.name,
      slug,
      description: cmd.description,
      avatar: cmd.avatar,
      systemPrompt: cmd.systemPrompt,
      modelId: cmd.modelId,
      skillIds: cmd.skillIds,
      toolIds: cmd.toolIds,
      createdBy: cmd.actorId,
      now,
    })
    if (!created.ok) return fail(created.error)
    const agent = created.value

    const bot = await this.botUsers.provision({
      name: agent.name,
      avatar: agent.avatar,
      agentId: id.value,
    })
    agent.linkBotUser(bot.userId)

    await this.agents.save(agent)
    await this.events.publish(agent.pullEvents())
    return ok(AgentMapper.toView(agent))
  }
}
