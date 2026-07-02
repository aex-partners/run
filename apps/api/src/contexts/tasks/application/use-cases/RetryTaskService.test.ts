import { describe, it, expect } from 'vitest'
import { RetryTaskService } from '@/contexts/tasks/application/use-cases/RetryTaskService'
import { TaskRepository } from '@/contexts/tasks/application/ports/out/TaskRepository'
import { TaskAssigneeRepository } from '@/contexts/tasks/application/ports/out/TaskAssigneeRepository'
import { Scheduler } from '@/contexts/tasks/application/ports/out/Scheduler'
import { Task } from '@/contexts/tasks/domain/Task'
import { TaskAssignee } from '@/contexts/tasks/domain/TaskAssignee'
import { TaskId } from '@/contexts/tasks/domain/ids'
import { TaskStatus } from '@/contexts/tasks/domain/TaskStatus'
import { TaskKind } from '@/contexts/tasks/domain/TaskKind'
import { TaskExecutor } from '@/contexts/tasks/domain/TaskExecutor'
import { TaskType } from '@/contexts/tasks/domain/TaskType'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2026-01-01T00:00:00Z')

const kindOf = (raw: string): TaskKind => {
  const r = TaskKind.of(raw)
  if (!r.ok) throw new Error(r.error)
  return r.value
}

interface SeedOverrides {
  id?: string
  status?: TaskStatus
  createdBy?: string
  kind?: TaskKind
  executor?: TaskExecutor
  type?: TaskType
}

const seedTask = (o: SeedOverrides = {}): Task =>
  Task.rehydrate({
    id: TaskId.of(o.id ?? 'orig'),
    title: 'Original work',
    description: 'do it again',
    status: o.status ?? 'failed',
    progress: 42,
    conversationId: 'conv-1',
    createdBy: o.createdBy ?? 'creator',
    result: null,
    error: 'boom',
    input: '{"foo":1}',
    scheduledAt: null,
    type: o.type ?? TaskType.inference(),
    agentId: 'agent-1',
    toolName: 'tool-1',
    inputSchema: '{"in":true}',
    outputSchema: '{"out":true}',
    structuredInput: '{"s":1}',
    executor: o.executor ?? TaskExecutor.human(),
    kind: o.kind ?? kindOf('approval'),
    dueAt: new Date('2026-02-01T00:00:00Z'),
    snoozedUntil: null,
    parentTaskId: 'parent-1',
    approvalDecision: null,
    createdAt: new Date('2025-12-01T00:00:00Z'),
    startedAt: null,
    completedAt: new Date('2025-12-02T00:00:00Z'),
  })

class InMemoryTaskRepo implements TaskRepository {
  private seq = 0
  readonly store = new Map<string, Task>()
  nextId(): TaskId {
    this.seq += 1
    return TaskId.of(`task-${this.seq}`)
  }
  async findById(id: TaskId): Promise<Task | null> {
    return this.store.get(id.value) ?? null
  }
  async save(task: Task): Promise<void> {
    this.store.set(task.id.value, task)
  }
}

class InMemoryAssigneeRepo implements TaskAssigneeRepository {
  readonly store: TaskAssignee[] = []
  async findOne(taskId: TaskId, userId: string): Promise<TaskAssignee | null> {
    return this.store.find((a) => a.taskId === taskId.value && a.userId === userId) ?? null
  }
  async listByTask(taskId: TaskId): Promise<TaskAssignee[]> {
    return this.store.filter((a) => a.taskId === taskId.value)
  }
  async saveAll(assignees: TaskAssignee[]): Promise<void> {
    this.store.push(...assignees)
  }
  async save(assignee: TaskAssignee): Promise<void> {
    this.store.push(assignee)
  }
}

class FakeScheduler implements Scheduler {
  readonly calls: { op: 'schedule' | 'cancel'; jobId: string; runAt?: Date }[] = []
  async schedule(jobId: string, runAt: Date): Promise<void> {
    this.calls.push({ op: 'schedule', jobId, runAt })
  }
  async cancel(jobId: string): Promise<void> {
    this.calls.push({ op: 'cancel', jobId })
  }
}

class RecordingPublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.events.push(...events)
  }
}

const fixedClock = (now: Date): Clock => ({ now: () => now })

const setup = () => {
  const tasks = new InMemoryTaskRepo()
  const assignees = new InMemoryAssigneeRepo()
  const scheduler = new FakeScheduler()
  const events = new RecordingPublisher()
  const service = new RetryTaskService(tasks, assignees, scheduler, events, fixedClock(NOW))
  return { tasks, assignees, scheduler, events, service }
}

describe('RetryTaskService', () => {
  it('fails with "Task not found" when the original does not exist', async () => {
    const { scheduler, events, service } = setup()
    const r = await service.execute({ userId: 'creator', id: 'missing' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('Task not found')
    expect(scheduler.calls).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })

  it('fails with "Task not found" when the user can neither own nor is assigned', async () => {
    const { tasks, scheduler, events, service } = setup()
    tasks.store.set('orig', seedTask({ createdBy: 'creator' }))
    const r = await service.execute({ userId: 'stranger', id: 'orig' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('Task not found')
    // Only the original is stored; nothing cloned/scheduled.
    expect(tasks.store.size).toBe(1)
    expect(scheduler.calls).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })

  it('clones the original into a new pending task owned by the retrier (creator path)', async () => {
    const { tasks, scheduler, events, service } = setup()
    tasks.store.set('orig', seedTask({ createdBy: 'creator' }))

    const r = await service.execute({ userId: 'creator', id: 'orig' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.id).toBe('task-1')

    const clone = tasks.store.get('task-1')
    expect(clone).toBeDefined()
    expect(clone?.status).toBe('pending')
    expect(clone?.progress).toBe(0)
    expect(clone?.createdBy).toBe('creator')
    expect(clone?.title).toBe('Original work')
    // createFrom omits kind/executor, falling back to DB defaults task/ai.
    expect(clone?.kind.value).toBe('task')
    expect(clone?.executor.value).toBe('ai')
    // type and payload fields are carried over; dueAt/parentTaskId reset.
    expect(clone?.type.value).toBe('inference')
    expect(clone?.input).toBe('{"foo":1}')
    expect(clone?.conversationId).toBe('conv-1')
    expect(clone?.agentId).toBe('agent-1')
    expect(clone?.dueAt).toBeNull()
    expect(clone?.parentTaskId).toBeNull()
    expect(clone?.createdAt).toEqual(NOW)

    // Enqueued immediately (runAt = now).
    expect(scheduler.calls).toEqual([{ op: 'schedule', jobId: 'task-1', runAt: NOW }])
    expect(events.events.map((e) => e.name)).toContain('tasks.TaskCreated')
  })

  it('lets an assignee (not the creator) retry the task', async () => {
    const { tasks, assignees, scheduler, service } = setup()
    tasks.store.set('orig', seedTask({ createdBy: 'creator' }))
    assignees.store.push(TaskAssignee.create('orig', 'bob', NOW))

    const r = await service.execute({ userId: 'bob', id: 'orig' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const clone = tasks.store.get('task-1')
    expect(clone?.createdBy).toBe('bob')
    expect(scheduler.calls[0]?.jobId).toBe('task-1')
  })

  it('preserves the structured type when retrying a structured task', async () => {
    const { tasks, service } = setup()
    tasks.store.set(
      'orig',
      seedTask({ createdBy: 'creator', type: TaskType.structured(), kind: TaskKind.task() }),
    )
    const r = await service.execute({ userId: 'creator', id: 'orig' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(tasks.store.get('task-1')?.type.value).toBe('structured')
  })
})
