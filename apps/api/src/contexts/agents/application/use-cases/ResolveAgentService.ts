import { ResolveAgent, ResolveAgentQuery } from '@/contexts/agents/application/ports/in/ResolveAgent'
import { AgentRepository } from '@/contexts/agents/application/ports/out/AgentRepository'
import { AgentResolver, ResolvedAgent } from '@/contexts/agents/domain/AgentResolver'
import { AgentId } from '@/contexts/agents/domain/AgentId'

// Backs the assistant ACL's agent resolution: load the agent (if any) and apply
// the pure AgentResolver rules over the skill fragments the caller supplies. The
// conversation -> agentId lookup and skill loading belong to the caller's
// contexts; this service owns only the agent-side rules.
export class ResolveAgentService implements ResolveAgent {
  constructor(private readonly agents: AgentRepository) {}

  async execute(query: ResolveAgentQuery): Promise<ResolvedAgent> {
    const agent = query.agentId ? await this.agents.findById(AgentId.of(query.agentId)) : null
    return AgentResolver.resolve(agent, query.skills ?? [], query.defaultName)
  }
}
