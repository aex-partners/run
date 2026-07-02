import { describe, it, expect } from 'vitest'
import { FlowFolderMapper, FlowFolderRow } from '@/contexts/automation/application/mappers/FlowFolderMapper'

describe('FlowFolderMapper', () => {
  const row: FlowFolderRow = {
    id: 'folder-1',
    displayName: 'Marketing',
    displayOrder: 3,
    createdAt: new Date('2024-01-01T00:00:00Z'),
  }

  it('round-trips a row through toDomain -> toPersistence unchanged', () => {
    const back = FlowFolderMapper.toPersistence(FlowFolderMapper.toDomain(row))
    expect(back).toEqual(row)
  })
})
