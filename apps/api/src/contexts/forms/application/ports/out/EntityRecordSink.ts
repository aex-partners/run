import { Result } from '@/shared/kernel/Result'
import { JsonObject } from '@/shared/domain/Json'

// ACL out-port to the `data` context. SubmitForm creates an entity record THROUGH
// this boundary instead of importing the data context. The data context owns the
// record's schema; a referential/schema failure surfaces here as a Result
// failure. Fulfilled in main by delegating to the data context's InsertRecord
// in-port — forms never sees that wiring.
export interface EntityRecordSink {
  insert(entityId: string, data: JsonObject): Promise<Result<{ id: string }>>
}
