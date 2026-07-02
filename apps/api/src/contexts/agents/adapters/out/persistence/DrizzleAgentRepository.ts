import { randomUUID } from 'node:crypto'
import { and, eq, ne } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { agents } from '@/platform/db/schema'
import { AgentRepository } from '@/contexts/agents/application/ports/out/AgentRepository'
import { AgentMapper, AgentRow } from '@/contexts/agents/application/mappers/AgentMapper'
import { Agent } from '@/contexts/agents/domain/Agent'
import { AgentId } from '@/contexts/agents/domain/AgentId'
import { AgentSlug } from '@/contexts/agents/domain/AgentSlug'

// Driven adapter over the `agents` table. The port and mapper stay identical to
// any other backing store; only the query mechanics live here.
export class DrizzleAgentRepository implements AgentRepository {
  constructor(private readonly db: Database) {}

  nextId(): AgentId {
    return AgentId.of(randomUUID())
  }

  async findById(id: AgentId): Promise<Agent | null> {
    const [row] = await this.db.select().from(agents).where(eq(agents.id, id.value)).limit(1)
    return row ? AgentMapper.toDomain(row as AgentRow) : null
  }

  async existsBySlug(slug: AgentSlug, exceptId?: AgentId): Promise<boolean> {
    const where = exceptId
      ? and(eq(agents.slug, slug.value), ne(agents.id, exceptId.value))
      : eq(agents.slug, slug.value)
    const [row] = await this.db.select({ id: agents.id }).from(agents).where(where).limit(1)
    return !!row
  }

  async save(agent: Agent): Promise<void> {
    const row = AgentMapper.toPersistence(agent)
    await this.db
      .insert(agents)
      .values(row)
      .onConflictDoUpdate({
        target: agents.id,
        set: {
          name: row.name,
          slug: row.slug,
          description: row.description,
          avatar: row.avatar,
          systemPrompt: row.systemPrompt,
          modelId: row.modelId,
          skillIds: row.skillIds,
          toolIds: row.toolIds,
          isSystem: row.isSystem,
          userId: row.userId,
          updatedAt: row.updatedAt,
        },
      })
  }

  async delete(id: AgentId): Promise<void> {
    await this.db.delete(agents).where(eq(agents.id, id.value))
  }
}
