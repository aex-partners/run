import { randomUUID } from 'node:crypto'
import { and, desc, eq, lt, type SQL } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { auditLog } from '@/platform/db/schema'
import {
  AuditRepository,
  AuditQueryFilter,
} from '@/contexts/audit/application/ports/out/AuditRepository'
import { AuditEntry } from '@/contexts/audit/domain/AuditEntry'
import { JsonObject } from '@/shared/domain/Json'

// Driven adapter. Maps AuditEntry <-> the append-only audit_log table.
export class DrizzleAuditRepository implements AuditRepository {
  constructor(private readonly db: Database) {}

  nextId(): string {
    return randomUUID()
  }

  async append(entry: AuditEntry): Promise<void> {
    await this.db.insert(auditLog).values({
      id: entry.id,
      actorId: entry.actorId,
      actorEmail: entry.actorEmail,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      metadata: entry.metadata,
      createdAt: entry.createdAt,
    })
  }

  async query(filter: AuditQueryFilter, limit: number): Promise<AuditEntry[]> {
    const conds: SQL[] = []
    if (filter.action) conds.push(eq(auditLog.action, filter.action))
    if (filter.resourceType) conds.push(eq(auditLog.resourceType, filter.resourceType))
    if (filter.actorId) conds.push(eq(auditLog.actorId, filter.actorId))
    if (filter.before) conds.push(lt(auditLog.createdAt, filter.before))

    const rows = await this.db
      .select()
      .from(auditLog)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)

    return rows.map(
      (r): AuditEntry => ({
        id: r.id,
        actorId: r.actorId,
        actorEmail: r.actorEmail,
        action: r.action,
        resourceType: r.resourceType,
        resourceId: r.resourceId,
        metadata: (r.metadata as JsonObject | null) ?? null,
        createdAt: r.createdAt,
      }),
    )
  }
}
