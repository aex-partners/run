import { Result } from '@/shared/kernel/Result'
import { AgentView } from '@/contexts/agents/application/queries/AgentView'

// Driving port. Plain-data command in (actorId is the creator), AgentView out.
// Mirrors agents.create.
export interface CreateAgentCommand {
  actorId: string
  name: string
  description?: string | null
  avatar?: string | null
  systemPrompt: string
  modelId?: string | null
  skillIds?: string[]
  toolIds?: string[]
}

export interface CreateAgent {
  execute(cmd: CreateAgentCommand): Promise<Result<AgentView>>
}
