import { Record } from '@/contexts/data/domain/Record'
import { RecordId } from '@/contexts/data/domain/RecordId'
import { EntityId } from '@/contexts/data/domain/EntityId'

export interface RecordRepository {
  nextId(): RecordId
  findById(id: RecordId): Promise<Record | null>
  // Persists an aggregate. Updates are compare-and-set on the version column;
  // implementations throw on a CAS miss (concurrent modification).
  save(record: Record): Promise<void>
  delete(id: RecordId): Promise<void>
  // Cross-aggregate existence check for relation fields. Eventual/structural
  // consistency between aggregates is the service's job, not the aggregate's.
  exists(entityId: EntityId, id: RecordId): Promise<boolean>
}
