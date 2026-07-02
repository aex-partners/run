import { describe, it, expect } from 'vitest'
import { FlowMapper, FlowRow } from '@/contexts/automation/application/mappers/FlowMapper'

describe('FlowMapper', () => {
  const row: FlowRow = {
    id: 'flow-1',
    status: 'enabled',
    folderId: 'folder-9',
    publishedVersionId: 'ver-3',
    createdBy: 'u1',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-02-02T00:00:00Z'),
  }

  it('round-trips a row through toDomain -> toPersistence unchanged', () => {
    const back = FlowMapper.toPersistence(FlowMapper.toDomain(row))
    expect(back).toEqual(row)
  })

  it('preserves null folder/published/createdBy', () => {
    const minimal: FlowRow = { ...row, folderId: null, publishedVersionId: null, createdBy: null, status: 'disabled' }
    const back = FlowMapper.toPersistence(FlowMapper.toDomain(minimal))
    expect(back).toEqual(minimal)
  })
})
