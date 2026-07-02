import { Database } from '@/platform/db/client'
import { flowFolders } from '@/platform/db/schema'
import { ListFolders, FolderView } from '@/contexts/automation/application/queries/ListFolders'

// Read-side adapter. Ports `flows.listFolders`: ordered by displayOrder.
export class DrizzleListFolders implements ListFolders {
  constructor(private readonly db: Database) {}

  async execute(): Promise<FolderView[]> {
    const rows = await this.db.select().from(flowFolders).orderBy(flowFolders.displayOrder)
    return rows.map((r) => ({
      id: r.id,
      displayName: r.displayName,
      displayOrder: r.displayOrder,
      createdAt: r.createdAt,
    }))
  }
}
