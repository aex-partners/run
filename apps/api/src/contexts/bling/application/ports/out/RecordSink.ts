import { Result } from '@/shared/kernel/Result'
import { JsonObject } from '@/shared/domain/Json'

// ACL out-port -> the data/records context. Upserts a single mirrored record
// keyed by its Bling external id, so repeated syncs converge instead of
// duplicating. `changed` reports whether the stored data differed from the
// existing record; `inserted` distinguishes a create from an update.
export interface RecordSink {
  upsertExternal(input: {
    entityId: string
    slug: string
    externalId: string
    data: JsonObject
    // Resolved sync owner id, threaded through to entity_records.created_by
    // on insert (updates don't need it).
    createdBy: string
  }): Promise<Result<{ recordId: string; changed: boolean; inserted: boolean }>>
}
