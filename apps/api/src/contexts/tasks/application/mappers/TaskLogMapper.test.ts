import { describe, it, expect } from 'vitest'
import { TaskLogMapper } from '@/contexts/tasks/application/mappers/TaskLogMapper'
import { TaskLog } from '@/contexts/tasks/domain/TaskLog'
import { TaskLogId, TaskId } from '@/contexts/tasks/domain/ids'

const CREATED_AT = new Date('2026-01-01T00:00:00Z')

describe('TaskLogMapper', () => {
  it('serialises metadata to a JSON string and deserialises it back to an object', () => {
    const metadata = { budgetSpent: 1200, tool: 'search', nested: { ok: true, items: [1, 2, 3] } }
    const original = TaskLog.rehydrate(
      TaskLogId.of('log-1'),
      TaskId.of('task-1'),
      'info',
      'spent budget',
      metadata,
      CREATED_AT,
    )

    const row = TaskLogMapper.toPersistence(original)
    expect(row.id).toBe('log-1')
    expect(row.taskId).toBe('task-1')
    expect(row.level).toBe('info')
    expect(row.message).toBe('spent budget')
    expect(typeof row.metadata).toBe('string')
    expect(row.metadata).toBe(JSON.stringify(metadata))
    expect(row.createdAt).toEqual(CREATED_AT)

    const back = TaskLogMapper.toDomain(row)
    expect(back.id.value).toBe('log-1')
    expect(back.taskId.value).toBe('task-1')
    expect(back.level).toBe('info')
    expect(back.message).toBe('spent budget')
    expect(back.metadata).toEqual(metadata)
    expect(back.createdAt).toEqual(CREATED_AT)
  })

  it('keeps metadata null through the round-trip (null branch)', () => {
    const original = TaskLog.rehydrate(
      TaskLogId.of('log-2'),
      TaskId.of('task-2'),
      'error',
      'something broke',
      null,
      CREATED_AT,
    )

    const row = TaskLogMapper.toPersistence(original)
    expect(row.metadata).toBeNull()

    const back = TaskLogMapper.toDomain(row)
    expect(back.metadata).toBeNull()
    expect(back.level).toBe('error')
    expect(back.message).toBe('something broke')
  })

  it('round-trips each log level', () => {
    for (const level of ['info', 'warn', 'error', 'step'] as const) {
      const row = TaskLogMapper.toPersistence(
        TaskLog.rehydrate(TaskLogId.of(`log-${level}`), TaskId.of('task-3'), level, level, null, CREATED_AT),
      )
      expect(TaskLogMapper.toDomain(row).level).toBe(level)
    }
  })
})
