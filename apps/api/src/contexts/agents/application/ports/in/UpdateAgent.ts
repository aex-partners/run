import { Result } from '@/shared/kernel/Result'
import { AgentView } from '@/contexts/agents/application/queries/AgentView'

// Driving port. Partial update; an absent field is left untouched. Mirrors
// agents.update (the slug is regenerated when the name changes).
export interface UpdateAgentCommand {
  id: string
  name?: string
  description?: string | null
  avatar?: string | null
  systemPrompt?: string
  modelId?: string | null
  skillIds?: string[]
  toolIds?: string[]
}

export interface UpdateAgent {
  execute(cmd: UpdateAgentCommand): Promise<Result<AgentView>>
}
