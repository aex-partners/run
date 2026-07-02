import { eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { plugins } from '@/platform/db/schema'
import { GetPlugin, GetPluginQuery } from '@/contexts/plugins/application/ports/in/GetPlugin'
import { PluginView } from '@/contexts/plugins/application/ports/in/ListPlugins'
import { toView } from '@/contexts/plugins/adapters/out/persistence/DrizzleListPlugins'

// Driven read-side adapter (CQRS). Answers `plugins.getById`; null when no match.
export class DrizzleGetPlugin implements GetPlugin {
  constructor(private readonly db: Database) {}

  async execute(query: GetPluginQuery): Promise<PluginView | null> {
    const [row] = await this.db.select().from(plugins).where(eq(plugins.id, query.id)).limit(1)
    return row ? toView(row) : null
  }
}
