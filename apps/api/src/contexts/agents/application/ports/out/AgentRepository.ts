import { Agent } from '@/contexts/agents/domain/Agent'
import { AgentId } from '@/contexts/agents/domain/AgentId'
import { AgentSlug } from '@/contexts/agents/domain/AgentSlug'

// Driven port. States WHAT the application needs from the agent store; an adapter
// under adapters/out implements HOW (Drizzle over the `agents` table, in-memory).
// existsBySlug backs the slug-uniqueness guard (optionally excluding the agent
// being updated).
export interface AgentRepository {
  nextId(): AgentId
  findById(id: AgentId): Promise<Agent | null>
  existsBySlug(slug: AgentSlug, exceptId?: AgentId): Promise<boolean>
  save(agent: Agent): Promise<void>
  delete(id: AgentId): Promise<void>
}
