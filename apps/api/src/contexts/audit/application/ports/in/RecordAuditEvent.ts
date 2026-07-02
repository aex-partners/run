import { Result } from '@/shared/kernel/Result'
import { JsonObject } from '@/shared/domain/Json'

// Driving port. Other contexts record audit events through this in-port, bridged
// via an ACL out-port in the composition root — they never import audit. Mirrors
// AEX's logAuditEvent helper (best-effort: a failed audit write must not break
// the business mutation it accompanies).
export interface RecordAuditEventCommand {
  actorId?: string | null
  actorEmail?: string | null
  action: string
  resourceType: string
  resourceId?: string | null
  metadata?: JsonObject | null
}

export interface RecordAuditEvent {
  execute(cmd: RecordAuditEventCommand): Promise<Result<void>>
}
