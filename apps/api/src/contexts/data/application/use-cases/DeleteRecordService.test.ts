import { describe, it, expect } from 'vitest'
import { DeleteRecordService } from '@/contexts/data/application/use-cases/DeleteRecordService'
import { RecordRepository } from '@/contexts/data/application/ports/out/RecordRepository'
import { EntityId } from '@/contexts/data/domain/EntityId'
import { RecordId } from '@/contexts/data/domain/RecordId'
import { Record } from '@/contexts/data/domain/Record'
import { Version } from '@/contexts/data/domain/Version'

class FakeRecordRepository implements RecordRepository {
  store = new Map<string, Record>()
  deleted: string[] = []
  private seq = 0
  nextId(): RecordId {
    return RecordId.of(`rec-${++this.seq}`)
  }
  async findById(id: RecordId): Promise<Record | null> {
    return this.store.get(id.value) ?? null
  }
  async save(record: Record): Promise<void> {
    this.store.set(record.id.value, record)
  }
  async delete(id: RecordId): Promise<void> {
    this.deleted.push(id.value)
    this.store.delete(id.value)
  }
  async exists(): Promise<boolean> {
    return true
  }
}

const seedRecord = (repo: FakeRecordRepository): void => {
  const rec = Record.rehydrate(
    RecordId.of('rec-1'),
    EntityId.of('ent-1'),
    { name: 'Acme' },
    Version.of(0),
  )
  repo.store.set('rec-1', rec)
}

describe('DeleteRecordService', () => {
  it('deletes an existing record', async () => {
    const repo = new FakeRecordRepository()
    seedRecord(repo)
    const service = new DeleteRecordService(repo)

    const r = await service.execute({ recordId: 'rec-1' })
    expect(r.ok).toBe(true)
    expect(repo.deleted).toEqual(['rec-1'])
    expect(repo.store.has('rec-1')).toBe(false)
  })

  it('fails when the record does not exist and does not delete', async () => {
    const repo = new FakeRecordRepository()
    const service = new DeleteRecordService(repo)
    const r = await service.execute({ recordId: 'missing' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('record not found')
    expect(repo.deleted).toHaveLength(0)
  })
})
