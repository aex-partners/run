import { describe, it, expect } from 'vitest'
import { RecordMapper } from '@/contexts/data/application/mappers/RecordMapper'
import { Record } from '@/contexts/data/domain/Record'
import { RecordId } from '@/contexts/data/domain/RecordId'
import { EntityId } from '@/contexts/data/domain/EntityId'
import { Version } from '@/contexts/data/domain/Version'

describe('RecordMapper', () => {
  it('toPersistence captures a record row', () => {
    const rec = Record.rehydrate(
      RecordId.of('rec-1'),
      EntityId.of('ent-1'),
      { name: 'Acme' },
      Version.of(3),
      'u1',
    )
    const row = RecordMapper.toPersistence(rec)
    expect(row).toEqual({
      id: 'rec-1',
      entityId: 'ent-1',
      data: { name: 'Acme' },
      version: 3,
      createdBy: 'u1',
    })
  })

  it('round-trips a record toPersistence -> toDomain', () => {
    const rec = Record.rehydrate(
      RecordId.of('rec-1'),
      EntityId.of('ent-1'),
      { name: 'Acme', n: 7 },
      Version.of(2),
      null,
    )
    const rebuilt = RecordMapper.toDomain(RecordMapper.toPersistence(rec))
    expect(rebuilt.id.value).toBe('rec-1')
    expect(rebuilt.entityId.value).toBe('ent-1')
    expect(rebuilt.data).toEqual({ name: 'Acme', n: 7 })
    expect(rebuilt.version.value).toBe(2)
  })
})
