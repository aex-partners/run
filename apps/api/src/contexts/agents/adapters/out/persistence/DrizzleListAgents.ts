import { Database } from '@/platform/db/client'
import { agents } from '@/platform/db/schema'
import { ListAgents } from '@/contexts/agents/application/ports/in/ListAgents'
import { AgentView } from '@/contexts/agents/application/queries/AgentView'
import { agentRowToView } from '@/contexts/agents/adapters/out/persistence/agentRowToView'

// Read-side adapter (CQRS). Mirrors agents.list — every agent row, projected.
export class DrizzleListAgents implements ListAgents {
  constructor(private readonly db: Database) {}

  async execute(): Promise<AgentView[]> {
    const rows = await this.db.select().from(agents)
    return rows.map(agentRowToView)
  }
}
