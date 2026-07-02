import { describe, it, expect } from 'vitest'
import { Notification } from '@/contexts/notifications/domain/Notification'
import { NotificationId, UserId, TaskId } from '@/contexts/notifications/domain/ids'
import { NotificationKind } from '@/contexts/notifications/domain/NotificationKind'

const NOW = new Date('2024-01-01T00:00:00.000Z')
const LATER = new Date('2024-01-02T00:00:00.000Z')

function kind(): NotificationKind {
  const r = NotificationKind.of('task_assigned')
  if (!r.ok) throw new Error('bad kind')
  return r.value
}

function create(title = 'You have a task', body: string | null = null, taskId: TaskId | null = null): Notification {
  const r = Notification.create({
    id: NotificationId.of('n1'),
    userId: UserId.of('u1'),
    kind: kind(),
    title,
    body,
    taskId,
    now: NOW,
  })
  if (!r.ok) throw new Error(`setup failed: ${r.error}`)
  return r.value
}

describe('Notification.create', () => {
  it('creates a notification and records NotificationCreated', () => {
    const r = Notification.create({
      id: NotificationId.of('n1'),
      userId: UserId.of('u1'),
      kind: kind(),
      title: '  Hello  ',
      body: 'b',
      taskId: TaskId.of('t1'),
      now: NOW,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.title).toBe('Hello')
    expect(r.value.isRead()).toBe(false)
    expect(r.value.pullEvents().map((e) => e.name)).toEqual(['notifications.NotificationCreated'])
  })

  it('rejects a blank title', () => {
    const r = Notification.create({
      id: NotificationId.of('n1'),
      userId: UserId.of('u1'),
      kind: kind(),
      title: '   ',
      body: null,
      taskId: null,
      now: NOW,
    })
    expect(r.ok).toBe(false)
  })
})

describe('Notification.markRead (read-once)', () => {
  it('marks read and records NotificationRead the first time', () => {
    const n = create()
    n.pullEvents()
    n.markRead(LATER)
    expect(n.isRead()).toBe(true)
    expect(n.readAt).toBe(LATER)
    expect(n.pullEvents().map((e) => e.name)).toEqual(['notifications.NotificationRead'])
  })

  it('is idempotent: a second markRead is a no-op and emits no event', () => {
    const n = create()
    n.markRead(LATER)
    n.pullEvents()
    n.markRead(new Date('2024-01-03T00:00:00.000Z'))
    expect(n.readAt).toBe(LATER)
    expect(n.pullEvents()).toHaveLength(0)
  })
})

describe('NotificationKind', () => {
  it('accepts every known kind', () => {
    for (const k of [
      'task_assigned',
      'task_acknowledged',
      'reminder_fired',
      'approval_requested',
      'approval_decided',
    ]) {
      expect(NotificationKind.of(k).ok).toBe(true)
    }
  })

  it('rejects an unknown kind', () => {
    expect(NotificationKind.of('nope').ok).toBe(false)
  })

  it('equals compares by value', () => {
    const a = NotificationKind.of('task_assigned')
    const b = NotificationKind.of('task_assigned')
    expect(a.ok && b.ok && a.value.equals(b.value)).toBe(true)
  })
})
