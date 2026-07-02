// ACL out-port to the shared audit trail (a cross-cutting concern owned by
// another context). Best-effort by contract: a failure to record must never
// break the business mutation it accompanies. Interface only; wired in main.
export interface AuditRecord {
  actorId: string | null
  actorEmail?: string | null
  action: string
  resourceType: string
  resourceId?: string | null
  metadata?: Record<string, unknown> | null
}

export interface AuditTrail {
  record(event: AuditRecord): Promise<void>
}
