import {
  ListAuditEntries,
  ListAuditEntriesQuery,
  AuditEntriesPage,
} from '@/contexts/audit/application/ports/in/ListAuditEntries'
import { AuditRepository } from '@/contexts/audit/application/ports/out/AuditRepository'
import { keysetPage } from '@/contexts/audit/domain/keyset'

// Read-side use case. Fetches one extra row (limit+1) and applies the pure
// keyset rule to split items from the next cursor.
export class ListAuditEntriesService implements ListAuditEntries {
  constructor(private readonly audit: AuditRepository) {}

  async execute(query: ListAuditEntriesQuery): Promise<AuditEntriesPage> {
    const rows = await this.audit.query(
      {
        action: query.action,
        resourceType: query.resourceType,
        actorId: query.actorId,
        before: query.before,
      },
      query.limit + 1,
    )
    const page = keysetPage(rows, query.limit, (r) => r.createdAt)
    return { items: page.items, nextCursor: page.nextCursor }
  }
}
