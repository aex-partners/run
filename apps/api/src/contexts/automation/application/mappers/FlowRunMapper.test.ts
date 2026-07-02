import { describe, it, expect } from 'vitest'
import { FlowRunMapper, FlowRunRow } from '@/contexts/automation/application/mappers/FlowRunMapper'

describe('FlowRunMapper', () => {
  const row: FlowRunRow = {
    id: 'run-1',
    flowId: 'flow-1',
    flowVersionId: 'ver-1',
    status: 'succeeded',
    triggeredBy: 'webhook',
    triggerPayload: JSON.stringify({ a: 1 }),
    steps: JSON.stringify({ step_1: { status: 'SUCCEEDED' } }),
    duration: 123,
    tags: '["t1"]',
    error: null,
    startedAt: new Date('2024-01-01T00:00:01Z'),
    completedAt: new Date('2024-01-01T00:00:02Z'),
    createdAt: new Date('2024-01-01T00:00:00Z'),
  }

  it('round-trips a row through toDomain -> toPersistence unchanged', () => {
    const back = FlowRunMapper.toPersistence(FlowRunMapper.toDomain(row))
    expect(back).toEqual(row)
  })

  it('preserves null version/payload/dates and an error message', () => {
    const pending: FlowRunRow = {
      ...row,
      flowVersionId: null,
      triggeredBy: null,
      triggerPayload: null,
      status: 'failed',
      duration: null,
      error: 'boom',
      startedAt: null,
      completedAt: null,
    }
    const back = FlowRunMapper.toPersistence(FlowRunMapper.toDomain(pending))
    expect(back).toEqual(pending)
  })
})
