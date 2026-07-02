import { describe, it, expect } from 'vitest'
import { TaskAssigneeMapper } from '@/contexts/tasks/application/mappers/TaskAssigneeMapper'
import { TaskAssignee } from '@/contexts/tasks/domain/TaskAssignee'

const CREATED_AT = new Date('2026-01-01T00:00:00Z')

describe('TaskAssigneeMapper', () => {
  it('round-trips a fresh assignee with all interaction timestamps null', () => {
    const original = TaskAssignee.create('task-1', 'alice', CREATED_AT)

    const row = TaskAssigneeMapper.toPersistence(original)
    expect(row).toEqual({
      taskId: 'task-1',
      userId: 'alice',
      seenAt: null,
      readAt: null,
      acknowledgedAt: null,
      snoozedUntil: null,
      createdAt: CREATED_AT,
    })

    const back = TaskAssigneeMapper.toDomain(row)
    expect(back.taskId).toBe('task-1')
    expect(back.userId).toBe('alice')
    expect(back.seenAt).toBeNull()
    expect(back.readAt).toBeNull()
    expect(back.acknowledgedAt).toBeNull()
    expect(back.snoozedUntil).toBeNull()
    expect(back.createdAt).toEqual(CREATED_AT)
    // Composite identity is preserved.
    expect(back.id.value).toBe('task-1::alice')
    expect(back.isAcknowledged()).toBe(false)
  })

  it('round-trips an assignee with every timestamp set', () => {
    const seenAt = new Date('2026-01-02T00:00:00Z')
    const readAt = new Date('2026-01-03T00:00:00Z')
    const acknowledgedAt = new Date('2026-01-04T00:00:00Z')
    const snoozedUntil = new Date('2026-01-05T00:00:00Z')

    const original = TaskAssignee.rehydrate({
      taskId: 'task-2',
      userId: 'bob',
      seenAt,
      readAt,
      acknowledgedAt,
      snoozedUntil,
      createdAt: CREATED_AT,
    })

    const row = TaskAssigneeMapper.toPersistence(original)
    const back = TaskAssigneeMapper.toDomain(row)

    expect(back.taskId).toBe('task-2')
    expect(back.userId).toBe('bob')
    expect(back.seenAt).toEqual(seenAt)
    expect(back.readAt).toEqual(readAt)
    expect(back.acknowledgedAt).toEqual(acknowledgedAt)
    expect(back.snoozedUntil).toEqual(snoozedUntil)
    expect(back.createdAt).toEqual(CREATED_AT)
    expect(back.isAcknowledged()).toBe(true)
    // Stable across a second serialisation.
    expect(TaskAssigneeMapper.toPersistence(back)).toEqual(row)
  })
})
