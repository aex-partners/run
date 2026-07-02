import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { flows } from '@/platform/db/schema'
import { FlowAggregateRepository } from '@/contexts/automation/application/ports/out/FlowAggregateRepository'
import { Flow } from '@/contexts/automation/domain/FlowAggregate'
import { FlowId } from '@/contexts/automation/domain/ids'
import { FlowMapper } from '@/contexts/automation/application/mappers/FlowMapper'

// Driven adapter over Drizzle/Postgres for the AEX `flows` table. `save` upserts.
export class DrizzleFlowRepository implements FlowAggregateRepository {
  constructor(private readonly db: Database) {}

  nextId(): FlowId {
    return FlowId.of(randomUUID())
  }

  async findById(id: FlowId): Promise<Flow | null> {
    const rows = await this.db.select().from(flows).where(eq(flows.id, id.value)).limit(1)
    const row = rows[0]
    if (!row) return null
    return FlowMapper.toDomain({
      id: row.id,
      status: row.status,
      folderId: row.folderId,
      publishedVersionId: row.publishedVersionId,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  }

  async save(flow: Flow): Promise<void> {
    const row = FlowMapper.toPersistence(flow)
    await this.db
      .insert(flows)
      .values({
        id: row.id,
        status: row.status,
        folderId: row.folderId,
        publishedVersionId: row.publishedVersionId,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })
      .onConflictDoUpdate({
        target: flows.id,
        set: {
          status: row.status,
          folderId: row.folderId,
          publishedVersionId: row.publishedVersionId,
          updatedAt: row.updatedAt,
        },
      })
  }

  async delete(id: FlowId): Promise<void> {
    await this.db.delete(flows).where(eq(flows.id, id.value))
  }
}
