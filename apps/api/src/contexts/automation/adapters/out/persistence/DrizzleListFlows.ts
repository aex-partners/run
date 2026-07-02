import { desc, eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { flows, flowVersions } from '@/platform/db/schema'
import { ListFlows, FlowListItem } from '@/contexts/automation/application/queries/ListFlows'

// Read-side adapter (CQRS). Ports `flows.list` 1:1: every flow with its latest
// version's displayName attached.
export class DrizzleListFlows implements ListFlows {
  constructor(private readonly db: Database) {}

  async execute(): Promise<FlowListItem[]> {
    const allFlows = await this.db.select().from(flows)
    return Promise.all(
      allFlows.map(async (f): Promise<FlowListItem> => {
        const latest = await this.db
          .select({ displayName: flowVersions.displayName })
          .from(flowVersions)
          .where(eq(flowVersions.flowId, f.id))
          .orderBy(desc(flowVersions.createdAt))
          .limit(1)
        return {
          id: f.id,
          status: f.status,
          folderId: f.folderId,
          publishedVersionId: f.publishedVersionId,
          displayName: latest[0]?.displayName ?? 'Untitled Flow',
          createdAt: f.createdAt,
          updatedAt: f.updatedAt,
        }
      }),
    )
  }
}
