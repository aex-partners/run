import { describe, it, expect } from 'vitest'
import { FlowVersionMapper, FlowVersionRow } from '@/contexts/automation/application/mappers/FlowVersionMapper'

describe('FlowVersionMapper', () => {
  const row: FlowVersionRow = {
    id: 'ver-1',
    flowId: 'flow-1',
    displayName: 'My version',
    trigger: JSON.stringify({ type: 'WEBHOOK' }),
    state: 'locked',
    valid: true,
    schemaVersion: 'v2',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-02-02T00:00:00Z'),
  }

  it('round-trips a row through toDomain -> toPersistence unchanged', () => {
    const back = FlowVersionMapper.toPersistence(FlowVersionMapper.toDomain(row))
    expect(back).toEqual(row)
  })

  it('preserves a draft state and a null schema version', () => {
    const draft: FlowVersionRow = { ...row, state: 'draft', valid: false, schemaVersion: null }
    const back = FlowVersionMapper.toPersistence(FlowVersionMapper.toDomain(draft))
    expect(back).toEqual(draft)
  })
})
