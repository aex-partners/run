import { randomUUID } from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { flowVersions } from '@/platform/db/schema'
import { FlowVersionRepository } from '@/contexts/automation/application/ports/out/FlowVersionRepository'
import { FlowVersion } from '@/contexts/automation/domain/FlowVersion'
import { FlowId, FlowVersionId } from '@/contexts/automation/domain/ids'
import { FlowVersionMapper, FlowVersionRow } from '@/contexts/automation/application/mappers/FlowVersionMapper'

// Driven adapter over Drizzle/Postgres for `flow_versions`.
export class DrizzleFlowVersionRepository implements FlowVersionRepository {
  constructor(private readonly db: Database) {}

  nextId(): FlowVersionId {
    return FlowVersionId.of(randomUUID())
  }

  async findById(id: FlowVersionId): Promise<FlowVersion | null> {
    const rows = await this.db.select().from(flowVersions).where(eq(flowVersions.id, id.value)).limit(1)
    return this.toDomain(rows[0])
  }

  async findByIdForFlow(id: FlowVersionId, flowId: FlowId): Promise<FlowVersion | null> {
    const rows = await this.db
      .select()
      .from(flowVersions)
      .where(and(eq(flowVersions.id, id.value), eq(flowVersions.flowId, flowId.value)))
      .limit(1)
    return this.toDomain(rows[0])
  }

  async findDraft(flowId: FlowId): Promise<FlowVersion | null> {
    const rows = await this.db
      .select()
      .from(flowVersions)
      .where(and(eq(flowVersions.flowId, flowId.value), eq(flowVersions.state, 'draft')))
      .limit(1)
    return this.toDomain(rows[0])
  }

  async findLatest(flowId: FlowId): Promise<FlowVersion | null> {
    const rows = await this.db
      .select()
      .from(flowVersions)
      .where(eq(flowVersions.flowId, flowId.value))
      .orderBy(desc(flowVersions.createdAt))
      .limit(1)
    return this.toDomain(rows[0])
  }

  async listForFlow(flowId: FlowId): Promise<FlowVersion[]> {
    const rows = await this.db
      .select()
      .from(flowVersions)
      .where(eq(flowVersions.flowId, flowId.value))
      .orderBy(desc(flowVersions.createdAt))
    return rows.map((r) => FlowVersionMapper.toDomain(this.row(r)))
  }

  async save(version: FlowVersion): Promise<void> {
    const row = FlowVersionMapper.toPersistence(version)
    await this.db
      .insert(flowVersions)
      .values(row)
      .onConflictDoUpdate({
        target: flowVersions.id,
        set: {
          displayName: row.displayName,
          trigger: row.trigger,
          state: row.state,
          valid: row.valid,
          schemaVersion: row.schemaVersion,
          updatedAt: row.updatedAt,
        },
      })
  }

  async deleteDrafts(flowId: FlowId): Promise<void> {
    await this.db
      .delete(flowVersions)
      .where(and(eq(flowVersions.flowId, flowId.value), eq(flowVersions.state, 'draft')))
  }

  private toDomain(row: typeof flowVersions.$inferSelect | undefined): FlowVersion | null {
    if (!row) return null
    return FlowVersionMapper.toDomain(this.row(row))
  }

  private row(row: typeof flowVersions.$inferSelect): FlowVersionRow {
    return {
      id: row.id,
      flowId: row.flowId,
      displayName: row.displayName,
      trigger: row.trigger,
      state: row.state,
      valid: row.valid,
      schemaVersion: row.schemaVersion,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }
}
