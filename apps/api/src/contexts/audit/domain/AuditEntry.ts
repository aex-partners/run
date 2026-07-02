import { JsonObject } from '@/shared/domain/Json'

// Generic-subdomain domain type: one immutable row of the append-only audit
// trail. No behaviour beyond construction — audit is a thin transaction-script
// subdomain, not a rich aggregate. actorEmail is a denormalized snapshot so
// attribution survives the actor being deleted.
export interface AuditEntry {
  readonly id: string
  readonly actorId: string | null
  readonly actorEmail: string | null
  readonly action: string
  readonly resourceType: string
  readonly resourceId: string | null
  readonly metadata: JsonObject | null
  readonly createdAt: Date
}
