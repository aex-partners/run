import { AuditEntry } from '@/contexts/audit/domain/AuditEntry'

// Driving port (read side). Admin-only, keyset-paginated view of the audit trail.
export interface ListAuditEntriesQuery {
  action?: string
  resourceType?: string
  actorId?: string
  before?: Date
  limit: number
}

export interface AuditEntriesPage {
  items: AuditEntry[]
  nextCursor: Date | null
}

export interface ListAuditEntries {
  execute(query: ListAuditEntriesQuery): Promise<AuditEntriesPage>
}
