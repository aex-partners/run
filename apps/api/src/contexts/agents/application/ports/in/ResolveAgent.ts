import { ResolvedAgent, SkillFragment } from '@/contexts/agents/domain/AgentResolver'

// Driving port serving the assistant context's ACL. The assistant resolves a
// conversation to its agentId and (optionally) preloads the agent's skills from
// the skills context, then asks the agents context to apply the resolution rules.
// A null agentId yields the named default agent.
export interface ResolveAgentQuery {
  agentId: string | null
  defaultName: string
  skills?: SkillFragment[]
}

export interface ResolveAgent {
  execute(query: ResolveAgentQuery): Promise<ResolvedAgent>
}
