import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import {
  RecordAuditEvent,
  RecordAuditEventCommand,
} from '@/contexts/audit/application/ports/in/RecordAuditEvent'
import { AuditRepository } from '@/contexts/audit/application/ports/out/AuditRepository'
import { AuditEntry } from '@/contexts/audit/domain/AuditEntry'

// Transaction-script use case: build the entry, append it. No aggregate, no
// events. Best-effort by design — a failed audit write is reported as a failure
// but is never allowed to throw, so the caller (an ACL bridge) can ignore it
// without breaking the business mutation that triggered the event.
export class RecordAuditEventService implements RecordAuditEvent {
  constructor(
    private readonly audit: AuditRepository,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: RecordAuditEventCommand): Promise<Result<void>> {
    const entry: AuditEntry = {
      id: this.audit.nextId(),
      actorId: cmd.actorId ?? null,
      actorEmail: cmd.actorEmail ?? null,
      action: cmd.action,
      resourceType: cmd.resourceType,
      resourceId: cmd.resourceId ?? null,
      metadata: cmd.metadata ?? null,
      createdAt: this.clock.now(),
    }
    try {
      await this.audit.append(entry)
      return ok(undefined)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'audit append failed')
    }
  }
}
