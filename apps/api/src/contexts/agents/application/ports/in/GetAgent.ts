import { AgentView } from '@/contexts/agents/application/queries/AgentView'

// Driving port (read). Mirrors agents.getById — a single agent or null.
export interface GetAgentQuery {
  id: string
}

export interface GetAgent {
  execute(query: GetAgentQuery): Promise<AgentView | null>
}
