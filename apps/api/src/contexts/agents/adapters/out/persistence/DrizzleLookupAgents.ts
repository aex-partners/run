import { eq, inArray } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { agents } from '@/platform/db/schema'
import { LookupAgents, AgentRef } from '@/contexts/agents/application/ports/in/LookupAgents'

// Read-side adapter (CQRS) over the OWN `agents` table. Batch-resolves the
// minimal agent reference other contexts consume via their ACL bridge.
export class DrizzleLookupAgents implements LookupAgents {
  constructor(private readonly db: Database) {}

  async byIds(ids: string[]): Promise<AgentRef[]> {
    if (ids.length === 0) return []

    const rows = await this.db
      .select({ id: agents.id, name: agents.name, slug: agents.slug })
      .from(agents)
      .where(inArray(agents.id, ids))

    return rows.map((a): AgentRef => ({ id: a.id, name: a.name, slug: a.slug }))
  }

  async bySlug(slug: string): Promise<AgentRef | null> {
    const [row] = await this.db
      .select({ id: agents.id, name: agents.name, slug: agents.slug })
      .from(agents)
      .where(eq(agents.slug, slug))
      .limit(1)

    return row ? { id: row.id, name: row.name, slug: row.slug } : null
  }
}
