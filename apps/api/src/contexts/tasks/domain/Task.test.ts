import { describe, it, expect } from 'vitest'
import { Task, CreateTaskProps } from '@/contexts/tasks/domain/Task'
import { TaskId } from '@/contexts/tasks/domain/ids'
import { TaskStatus } from '@/contexts/tasks/domain/TaskStatus'
import { TaskKind } from '@/contexts/tasks/domain/TaskKind'
import { TaskExecutor } from '@/contexts/tasks/domain/TaskExecutor'
import { TaskType } from '@/contexts/tasks/domain/TaskType'

const NOW = new Date('2026-01-01T00:00:00Z')
const LATER = new Date('2026-01-02T00:00:00Z')

const approvalKind = (): TaskKind => {
  const r = TaskKind.of('approval')
  if (!r.ok) throw new Error('approval kind must parse')
  return r.value
}

const createProps = (over: Partial<CreateTaskProps> = {}): CreateTaskProps => ({
  id: TaskId.of('t1'),
  title: 'Test task',
  description: null,
  kind: TaskKind.task(),
  executor: TaskExecutor.ai(),
  type: TaskType.inference(),
  createdBy: 'user-1',
  conversationId: null,
  input: null,
  dueAt: null,
  parentTaskId: null,
  agentId: null,
  toolName: null,
  inputSchema: null,
  outputSchema: null,
  structuredInput: null,
  now: NOW,
  ...over,
})

// Rehydrate a task directly into an arbitrary status (no events) so the illegal
// transitions can be enumerated cleanly from every starting state.
const inStatus = (status: TaskStatus, over: Record<string, unknown> = {}): Task =>
  Task.rehydrate({
    id: TaskId.of('t1'),
    title: 'Test',
    description: null,
    status,
    progress: 0,
    conversationId: null,
    createdBy: 'user-1',
    result: null,
    error: null,
    input: null,
    scheduledAt: null,
    type: TaskType.inference(),
    agentId: null,
    toolName: null,
    inputSchema: null,
    outputSchema: null,
    structuredInput: null,
    executor: TaskExecutor.ai(),
    kind: TaskKind.task(),
    dueAt: null,
    snoozedUntil: null,
    parentTaskId: null,
    approvalDecision: null,
    createdAt: NOW,
    startedAt: null,
    completedAt: null,
    ...over,
  })

const ALL_STATUSES: TaskStatus[] = ['pending', 'running', 'completed', 'failed', 'cancelled', 'acknowledged']

describe('Task.create', () => {
  it('is born pending with 0 progress and records TaskCreated', () => {
    const r = Task.create(createProps())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const task = r.value
    expect(task.status).toBe('pending')
    expect(task.progress).toBe(0)
    expect(task.createdAt).toEqual(NOW)
    expect(task.startedAt).toBeNull()
    expect(task.completedAt).toBeNull()
    const events = task.pullEvents()
    expect(events).toHaveLength(1)
    expect(events[0]?.name).toBe('tasks.TaskCreated')
  })

  it('trims the title', () => {
    const r = Task.create(createProps({ title: '  hello  ' }))
    expect(r.ok && r.value.title).toBe('hello')
  })

  it('rejects an empty / whitespace-only title', () => {
    expect(Task.create(createProps({ title: '' })).ok).toBe(false)
    expect(Task.create(createProps({ title: '   ' })).ok).toBe(false)
  })
})

describe('Task.createFrom (retry)', () => {
  it('clones into a new pending task owned by the retrier with task/ai defaults', () => {
    const orig = Task.create(
      createProps({ kind: approvalKind(), executor: TaskExecutor.human(), input: 'do x', conversationId: 'c1' }),
    )
    expect(orig.ok).toBe(true)
    if (!orig.ok) return
    const r = Task.createFrom(orig.value, TaskId.of('t2'), 'user-2', LATER)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const retry = r.value
    expect(retry.id.value).toBe('t2')
    expect(retry.createdBy).toBe('user-2')
    expect(retry.status).toBe('pending')
    expect(retry.kind.value).toBe('task')
    expect(retry.executor.value).toBe('ai')
    expect(retry.input).toBe('do x')
    expect(retry.dueAt).toBeNull()
    expect(retry.parentTaskId).toBeNull()
  })
})

describe('Task.start (pending -> running)', () => {
  it('moves a pending task to running, stamps startedAt, records TaskStarted', () => {
    const task = inStatus('pending')
    const r = task.start(LATER)
    expect(r.ok).toBe(true)
    expect(task.status).toBe('running')
    expect(task.startedAt).toEqual(LATER)
    expect(task.pullEvents()[0]?.name).toBe('tasks.TaskStarted')
  })

  it.each(ALL_STATUSES.filter((s) => s !== 'pending'))('fails to start a %s task', (status) => {
    const task = inStatus(status)
    const r = task.start(LATER)
    expect(r.ok).toBe(false)
    expect(task.status).toBe(status)
    expect(task.pullEvents()).toHaveLength(0)
  })
})

describe('Task.complete (running -> completed)', () => {
  it('completes a running task, jumps progress to 100, stores result', () => {
    const task = inStatus('running')
    const r = task.complete('the answer', LATER)
    expect(r.ok).toBe(true)
    expect(task.status).toBe('completed')
    expect(task.progress).toBe(100)
    expect(task.result).toBe('the answer')
    expect(task.completedAt).toEqual(LATER)
    expect(task.pullEvents()[0]?.name).toBe('tasks.TaskCompleted')
  })

  it.each(ALL_STATUSES.filter((s) => s !== 'running'))('fails to complete a %s task', (status) => {
    const task = inStatus(status)
    const r = task.complete('x', LATER)
    expect(r.ok).toBe(false)
    expect(task.status).toBe(status)
  })
})

describe('Task.fail (running -> failed)', () => {
  it('fails a running task and records the error', () => {
    const task = inStatus('running')
    const r = task.fail('boom', LATER)
    expect(r.ok).toBe(true)
    expect(task.status).toBe('failed')
    expect(task.error).toBe('boom')
    expect(task.completedAt).toEqual(LATER)
    expect(task.pullEvents()[0]?.name).toBe('tasks.TaskFailed')
  })

  it.each(ALL_STATUSES.filter((s) => s !== 'running'))('fails to fail a %s task', (status) => {
    const task = inStatus(status)
    expect(task.fail('x', LATER).ok).toBe(false)
    expect(task.status).toBe(status)
  })
})

describe('Task.cancelDuringRun (running -> cancelled)', () => {
  it('cancels a running task and clears the error', () => {
    const task = inStatus('running', { error: 'partial' })
    const r = task.cancelDuringRun(LATER)
    expect(r.ok).toBe(true)
    expect(task.status).toBe('cancelled')
    expect(task.error).toBeNull()
    expect(task.completedAt).toEqual(LATER)
    expect(task.pullEvents()[0]?.name).toBe('tasks.TaskCancelled')
  })

  it.each(ALL_STATUSES.filter((s) => s !== 'running'))('fails to cancelDuringRun a %s task', (status) => {
    const task = inStatus(status)
    expect(task.cancelDuringRun(LATER).ok).toBe(false)
    expect(task.status).toBe(status)
  })
})

describe('Task.cancel (pending|running -> cancelled)', () => {
  it.each(['pending', 'running'] as TaskStatus[])('cancels a %s task', (status) => {
    const task = inStatus(status)
    const r = task.cancel(LATER)
    expect(r.ok).toBe(true)
    expect(task.status).toBe('cancelled')
    expect(task.completedAt).toEqual(LATER)
    expect(task.pullEvents()[0]?.name).toBe('tasks.TaskCancelled')
  })

  it.each(['completed', 'failed', 'cancelled', 'acknowledged'] as TaskStatus[])(
    'refuses to cancel a %s task',
    (status) => {
      const task = inStatus(status)
      expect(task.cancel(LATER).ok).toBe(false)
      expect(task.status).toBe(status)
    },
  )
})

describe('Task.acknowledge', () => {
  it.each(['pending', 'running', 'completed'] as TaskStatus[])('acknowledges a %s task', (status) => {
    const task = inStatus(status)
    const r = task.acknowledge(LATER)
    expect(r.ok).toBe(true)
    expect(task.status).toBe('acknowledged')
    expect(task.completedAt).toEqual(LATER)
    expect(task.pullEvents()[0]?.name).toBe('tasks.TaskAcknowledged')
  })

  it('is an idempotent no-op when already acknowledged (no new event)', () => {
    const task = inStatus('acknowledged')
    const r = task.acknowledge(LATER)
    expect(r.ok).toBe(true)
    expect(task.status).toBe('acknowledged')
    expect(task.pullEvents()).toHaveLength(0)
  })

  it.each(['cancelled', 'failed'] as TaskStatus[])('refuses to acknowledge a %s task', (status) => {
    const task = inStatus(status)
    expect(task.acknowledge(LATER).ok).toBe(false)
    expect(task.status).toBe(status)
  })
})

describe('Task.snooze', () => {
  it.each(['pending', 'running'] as TaskStatus[])('snoozes a %s task without changing status', (status) => {
    const task = inStatus(status)
    const r = task.snooze(LATER, NOW)
    expect(r.ok).toBe(true)
    expect(task.status).toBe(status)
    expect(task.snoozedUntil).toEqual(LATER)
    expect(task.scheduledAt).toEqual(LATER)
    expect(task.pullEvents()[0]?.name).toBe('tasks.TaskSnoozed')
  })

  it.each(['completed', 'failed', 'cancelled', 'acknowledged'] as TaskStatus[])(
    'refuses to snooze a %s task',
    (status) => {
      const task = inStatus(status)
      expect(task.snooze(LATER, NOW).ok).toBe(false)
      expect(task.snoozedUntil).toBeNull()
    },
  )
})

describe('Task.approve / Task.reject (kind=approval)', () => {
  it('approves an approval task, recording the decision and closing it', () => {
    const task = inStatus('pending', { kind: approvalKind() })
    const r = task.approve(LATER)
    expect(r.ok).toBe(true)
    expect(task.approvalDecision).toBe('approved')
    expect(task.status).toBe('acknowledged')
    expect(task.completedAt).toEqual(LATER)
    expect(task.pullEvents()[0]?.name).toBe('tasks.TaskApprovalDecided')
  })

  it('rejects an approval task', () => {
    const task = inStatus('running', { kind: approvalKind() })
    const r = task.reject(LATER)
    expect(r.ok).toBe(true)
    expect(task.approvalDecision).toBe('rejected')
    expect(task.status).toBe('acknowledged')
  })

  it('refuses approve/reject on a non-approval task', () => {
    const task = inStatus('pending', { kind: TaskKind.task() })
    expect(task.approve(LATER).ok).toBe(false)
    expect(task.reject(LATER).ok).toBe(false)
    expect(task.approvalDecision).toBeNull()
  })

  it('refuses a second decision (already decided)', () => {
    const task = inStatus('pending', { kind: approvalKind() })
    expect(task.approve(LATER).ok).toBe(true)
    const second = task.reject(LATER)
    expect(second.ok).toBe(false)
    expect(task.approvalDecision).toBe('approved')
  })

  it.each(['cancelled', 'failed'] as TaskStatus[])('refuses to decide a %s approval task', (status) => {
    const task = inStatus(status, { kind: approvalKind() })
    expect(task.approve(LATER).ok).toBe(false)
    expect(task.approvalDecision).toBeNull()
  })
})

describe('Task full lifecycle (happy path)', () => {
  it('pending -> running -> completed via the factory + transitions', () => {
    const created = Task.create(createProps())
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const task = created.value
    expect(task.start(LATER).ok).toBe(true)
    expect(task.status).toBe('running')
    expect(task.complete('done', LATER).ok).toBe(true)
    expect(task.status).toBe('completed')
    expect(task.progress).toBe(100)
  })
})
