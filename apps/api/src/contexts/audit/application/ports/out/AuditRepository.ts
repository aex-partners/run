import { AuditEntry } from '@/contexts/audit/domain/AuditEntry'

export interface AuditQueryFilter {
  action?: string
  resourceType?: string
  actorId?: string
  before?: Date
}

// Driven port. The application states WHAT it needs from persistence; a Drizzle
// adapter under adapters/out says HOW.
export interface AuditRepository {
  nextId(): string
  append(entry: AuditEntry): Promise<void>
  // Fetch up to `limit` rows newest-first. Callers pass limit+1 for keyset paging.
  query(filter: AuditQueryFilter, limit: number): Promise<AuditEntry[]>
}
