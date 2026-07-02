import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { flowFolders } from '@/platform/db/schema'
import { FlowFolderRepository } from '@/contexts/automation/application/ports/out/FlowFolderRepository'
import { FlowFolder } from '@/contexts/automation/domain/FlowFolder'
import { FlowFolderId } from '@/contexts/automation/domain/ids'
import { FlowFolderMapper } from '@/contexts/automation/application/mappers/FlowFolderMapper'

// Driven adapter over Drizzle/Postgres for `flow_folders`.
export class DrizzleFlowFolderRepository implements FlowFolderRepository {
  constructor(private readonly db: Database) {}

  nextId(): FlowFolderId {
    return FlowFolderId.of(randomUUID())
  }

  async findById(id: FlowFolderId): Promise<FlowFolder | null> {
    const rows = await this.db.select().from(flowFolders).where(eq(flowFolders.id, id.value)).limit(1)
    const row = rows[0]
    if (!row) return null
    return FlowFolderMapper.toDomain({
      id: row.id,
      displayName: row.displayName,
      displayOrder: row.displayOrder,
      createdAt: row.createdAt,
    })
  }

  async save(folder: FlowFolder): Promise<void> {
    const row = FlowFolderMapper.toPersistence(folder)
    await this.db
      .insert(flowFolders)
      .values(row)
      .onConflictDoUpdate({
        target: flowFolders.id,
        set: { displayName: row.displayName, displayOrder: row.displayOrder },
      })
  }

  async delete(id: FlowFolderId): Promise<void> {
    await this.db.delete(flowFolders).where(eq(flowFolders.id, id.value))
  }
}
