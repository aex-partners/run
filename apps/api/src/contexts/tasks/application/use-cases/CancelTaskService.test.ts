import { describe, it, expect } from 'vitest'
import { CancelTaskService } from '@/contexts/tasks/application/use-cases/CancelTaskService'
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

const taskInStatus = (id: string, status: TaskStatus, createdBy: string): Task =>
  Task.rehydrate({
    id: TaskId.of(id),
    title: 'A task',
    description: null,
    status,
    progress: 0,
    conversationId: null,
    createdBy,
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
    executor: TaskExecutor.human(),
    kind: TaskKind.task(),
    dueAt: null,
    snoozedUntil: null,
    parentTaskId: null,
    approvalDecision: null,
    createdAt: NOW,
    startedAt: null,
    completedAt: null,
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
  readonly cancelled: string[] = []
  async schedule(): Promise<void> {}
  async cancel(jobId: string): Promise<void> {
    this.cancelled.push(jobId)
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
  const service = new CancelTaskService(tasks, assignees, scheduler, events, fixedClock(NOW))
  return { tasks, assignees, scheduler, events, service }
}

describe('CancelTaskService', () => {
  it('lets the creator cancel a pending task: status cancelled, job dropped, event published', async () => {
    const { tasks, scheduler, events, service } = setup()
    await tasks.save(taskInStatus('t1', 'pending', 'creator'))
    const r = await service.execute({ id: 't1', userId: 'creator' })
    expect(r.ok).toBe(true)
    expect(tasks.store.get('t1')?.status).toBe('cancelled')
    expect(scheduler.cancelled).toEqual(['t1'])
    expect(events.events.map((e) => e.name)).toContain('tasks.TaskCancelled')
  })

  it('lets an assignee cancel a running task', async () => {
    const { tasks, assignees, service } = setup()
    await tasks.save(taskInStatus('t1', 'running', 'creator'))
    assignees.store.push(TaskAssignee.create('t1', 'alice', NOW))
    const r = await service.execute({ id: 't1', userId: 'alice' })
    expect(r.ok).toBe(true)
    expect(tasks.store.get('t1')?.status).toBe('cancelled')
  })

  it('fails with "Task not found" when the task is missing', async () => {
    const { service } = setup()
    const r = await service.execute({ id: 'ghost', userId: 'creator' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('Task not found')
  })

  it('hides the task ("Task not found") from a non-creator non-assignee', async () => {
    const { tasks, scheduler, service } = setup()
    await tasks.save(taskInStatus('t1', 'pending', 'creator'))
    const r = await service.execute({ id: 't1', userId: 'intruder' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('Task not found')
    expect(tasks.store.get('t1')?.status).toBe('pending')
    expect(scheduler.cancelled).toHaveLength(0)
  })

  it('fails when the task is already terminal (cancel transition guarded)', async () => {
    const { tasks, scheduler, service } = setup()
    await tasks.save(taskInStatus('t1', 'completed', 'creator'))
    const r = await service.execute({ id: 't1', userId: 'creator' })
    expect(r.ok).toBe(false)
    expect(tasks.store.get('t1')?.status).toBe('completed')
    expect(scheduler.cancelled).toHaveLength(0)
  })
})
