import { JsonObject } from '@/shared/domain/Json'
import { Record } from '@/contexts/data/domain/Record'
import { RecordId } from '@/contexts/data/domain/RecordId'
import { EntityId } from '@/contexts/data/domain/EntityId'
import { Version } from '@/contexts/data/domain/Version'

// Mirrors the AEX `entity_records` table: id, entity_id, data JSON, version,
// created_by. The schemaless storage lives entirely here.
export interface RecordRow {
  id: string
  entityId: string
  data: JsonObject
  version: number
  createdBy: string | null
}

export const RecordMapper = {
  toPersistence(record: Record): RecordRow {
    return {
      id: record.id.value,
      entityId: record.entityId.value,
      data: record.data,
      version: record.version.value,
      createdBy: record.createdBy,
    }
  },

  toDomain(row: RecordRow): Record {
    return Record.rehydrate(
      RecordId.of(row.id),
      EntityId.of(row.entityId),
      row.data,
      Version.of(row.version),
      row.createdBy,
    )
  },
}
