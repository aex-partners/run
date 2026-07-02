import { desc, eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { flows, flowVersions } from '@/platform/db/schema'
import { GetFlow, FlowDetailView, FlowVersionView } from '@/contexts/automation/application/queries/GetFlow'

// Read-side adapter. Ports `flows.getById`: a flow plus all its versions, newest first.
export class DrizzleGetFlow implements GetFlow {
  constructor(private readonly db: Database) {}

  async execute(q: { id: string }): Promise<FlowDetailView | null> {
    const rows = await this.db.select().from(flows).where(eq(flows.id, q.id)).limit(1)
    const flow = rows[0]
    if (!flow) return null

    const versions = await this.db
      .select()
      .from(flowVersions)
      .where(eq(flowVersions.flowId, q.id))
      .orderBy(desc(flowVersions.createdAt))

    return {
      id: flow.id,
      status: flow.status,
      folderId: flow.folderId,
      publishedVersionId: flow.publishedVersionId,
      createdAt: flow.createdAt,
      updatedAt: flow.updatedAt,
      versions: versions.map(toVersionView),
    }
  }
}

export function toVersionView(v: typeof flowVersions.$inferSelect): FlowVersionView {
  return {
    id: v.id,
    flowId: v.flowId,
    displayName: v.displayName,
    trigger: v.trigger,
    state: v.state,
    valid: v.valid,
    schemaVersion: v.schemaVersion,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  }
}
