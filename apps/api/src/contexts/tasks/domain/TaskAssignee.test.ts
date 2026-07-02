import { describe, it, expect } from 'vitest'
import { TaskAssignee } from '@/contexts/tasks/domain/TaskAssignee'
import { TaskAssigneeId } from '@/contexts/tasks/domain/ids'

const NOW = new Date('2026-01-01T00:00:00Z')
const LATER = new Date('2026-01-02T00:00:00Z')
const EARLIER = new Date('2025-12-31T00:00:00Z')

describe('TaskAssignee.create', () => {
  it('starts with no seen/read/acknowledged/snoozed state', () => {
    const a = TaskAssignee.create('task-1', 'user-1', NOW)
    expect(a.taskId).toBe('task-1')
    expect(a.userId).toBe('user-1')
    expect(a.seenAt).toBeNull()
    expect(a.readAt).toBeNull()
    expect(a.acknowledgedAt).toBeNull()
    expect(a.snoozedUntil).toBeNull()
    expect(a.createdAt).toEqual(NOW)
    expect(a.isAcknowledged()).toBe(false)
  })

  it('has a composite (task + user) identity', () => {
    const a = TaskAssignee.create('task-1', 'user-1', NOW)
    expect(a.id.equals(TaskAssigneeId.of('task-1', 'user-1'))).toBe(true)
    expect(a.id.value).toBe('task-1::user-1')
  })
})

describe('TaskAssignee.acknowledge', () => {
  it('acks and backfills seen/read to now, records the event', () => {
    const a = TaskAssignee.create('task-1', 'user-1', EARLIER)
    const r = a.acknowledge(NOW)
    expect(r.ok).toBe(true)
    expect(a.acknowledgedAt).toEqual(NOW)
    expect(a.readAt).toEqual(NOW)
    expect(a.seenAt).toEqual(NOW)
    expect(a.isAcknowledged()).toBe(true)
    const events = a.pullEvents()
    expect(events).toHaveLength(1)
    expect(events[0]?.name).toBe('tasks.AssigneeAcknowledged')
  })

  it('preserves a pre-existing seenAt/readAt (readAt ?? now)', () => {
    const a = TaskAssignee.rehydrate({
      taskId: 'task-1',
      userId: 'user-1',
      seenAt: EARLIER,
      readAt: EARLIER,
      acknowledgedAt: null,
      snoozedUntil: null,
      createdAt: EARLIER,
    })
    const r = a.acknowledge(NOW)
    expect(r.ok).toBe(true)
    expect(a.acknowledgedAt).toEqual(NOW)
    expect(a.readAt).toEqual(EARLIER)
    expect(a.seenAt).toEqual(EARLIER)
  })

  it('is an idempotent no-op when already acknowledged (no new event, time unchanged)', () => {
    const a = TaskAssignee.create('task-1', 'user-1', EARLIER)
    expect(a.acknowledge(NOW).ok).toBe(true)
    a.pullEvents()
    const r = a.acknowledge(LATER)
    expect(r.ok).toBe(true)
    expect(a.acknowledgedAt).toEqual(NOW)
    expect(a.pullEvents()).toHaveLength(0)
  })
})

describe('TaskAssignee.snooze', () => {
  it('sets the snooze target', () => {
    const a = TaskAssignee.create('task-1', 'user-1', NOW)
    const r = a.snooze(LATER)
    expect(r.ok).toBe(true)
    expect(a.snoozedUntil).toEqual(LATER)
  })
})
