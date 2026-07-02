import { JsonObject } from '@/shared/domain/Json'

// ACL (anti-corruption) out-port. settings.set records an admin audit event
// without importing the audit context: the composition root bridges this to the
// audit context's RecordAuditEvent in-port.
export interface AuditTrailEvent {
  actorId: string | null
  actorEmail?: string | null
  action: string
  resourceType: string
  resourceId?: string | null
  metadata?: JsonObject | null
}

export interface AuditTrail {
  record(event: AuditTrailEvent): Promise<void>
}
