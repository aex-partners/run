import { eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { agents } from '@/platform/db/schema'
import { GetAgent, GetAgentQuery } from '@/contexts/agents/application/ports/in/GetAgent'
import { AgentView } from '@/contexts/agents/application/queries/AgentView'
import { agentRowToView } from '@/contexts/agents/adapters/out/persistence/agentRowToView'

// Read-side adapter (CQRS). Mirrors agents.getById — a single agent or null.
export class DrizzleGetAgent implements GetAgent {
  constructor(private readonly db: Database) {}

  async execute(query: GetAgentQuery): Promise<AgentView | null> {
    const [row] = await this.db.select().from(agents).where(eq(agents.id, query.id)).limit(1)
    return row ? agentRowToView(row) : null
  }
}
