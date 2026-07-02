import { randomUUID } from 'node:crypto'
import { RecordRepository } from '@/contexts/data/application/ports/out/RecordRepository'
import { Record } from '@/contexts/data/domain/Record'
import { RecordId } from '@/contexts/data/domain/RecordId'
import { EntityId } from '@/contexts/data/domain/EntityId'
import { RecordMapper } from '@/contexts/data/application/mappers/RecordMapper'
import { InMemoryRecordStore } from '@/contexts/data/adapters/out/persistence/InMemoryRecordStore'

export class InMemoryRecordRepository implements RecordRepository {
  constructor(private readonly store: InMemoryRecordStore) {}

  nextId(): RecordId {
    return RecordId.of(randomUUID())
  }

  async findById(id: RecordId): Promise<Record | null> {
    const row = this.store.rows.get(id.value)
    return row ? RecordMapper.toDomain(row) : null
  }

  async save(record: Record): Promise<void> {
    this.store.rows.set(record.id.value, RecordMapper.toPersistence(record))
  }

  async delete(id: RecordId): Promise<void> {
    this.store.rows.delete(id.value)
  }

  async exists(entityId: EntityId, id: RecordId): Promise<boolean> {
    const row = this.store.rows.get(id.value)
    return !!row && row.entityId === entityId.value
  }
}
