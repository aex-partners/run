import { AgentView } from '@/contexts/agents/application/queries/AgentView'

// Driving port (read). Mirrors agents.list — every agent definition.
export interface ListAgents {
  execute(): Promise<AgentView[]>
}
