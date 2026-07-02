import { desc, eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { flowVersions } from '@/platform/db/schema'
import { ListVersions } from '@/contexts/automation/application/queries/ListVersions'
import { FlowVersionView } from '@/contexts/automation/application/queries/GetFlow'
import { toVersionView } from '@/contexts/automation/adapters/out/persistence/DrizzleGetFlow'

// Read-side adapter. Ports `flows.listVersions`.
export class DrizzleListVersions implements ListVersions {
  constructor(private readonly db: Database) {}

  async execute(q: { flowId: string }): Promise<FlowVersionView[]> {
    const rows = await this.db
      .select()
      .from(flowVersions)
      .where(eq(flowVersions.flowId, q.flowId))
      .orderBy(desc(flowVersions.createdAt))
    return rows.map(toVersionView)
  }
}
