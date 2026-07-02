// Wiring for the `audit` context. No cross-context construction-time dependencies.
// Exposes RecordAuditEvent, which identity and settings bridge their AuditTrail
// out-ports to.
import { Infra } from '@/main/wiring/infra'

import { DrizzleAuditRepository } from '@/contexts/audit/adapters/out/persistence/DrizzleAuditRepository'
import { RecordAuditEventService } from '@/contexts/audit/application/use-cases/RecordAuditEventService'
import { ListAuditEntriesService } from '@/contexts/audit/application/use-cases/ListAuditEntriesService'
import { auditController } from '@/contexts/audit/adapters/in/http/AuditController'

export function wireAudit(infra: Infra) {
  const { db, clock } = infra
  const auditRepo = new DrizzleAuditRepository(db)
  const recordAuditEvent = new RecordAuditEventService(auditRepo, clock)
  const listAuditEntries = new ListAuditEntriesService(auditRepo)
  const auditCtl = auditController({ list: listAuditEntries })
  return { controller: auditCtl, ports: { recordAuditEvent } }
}

export type AuditWiring = ReturnType<typeof wireAudit>
