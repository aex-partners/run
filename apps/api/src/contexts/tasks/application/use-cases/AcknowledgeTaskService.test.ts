import { describe, it, expect } from 'vitest'
import { AcknowledgeTaskService } from '@/contexts/tasks/application/use-cases/AcknowledgeTaskService'
import { TaskRepository } from '@/contexts/tasks/application/ports/out/TaskRepository'
import { TaskAssigneeRepository } from '@/contexts/tasks/application/ports/out/TaskAssigneeRepository'
import { Notifier, NotifyRequest } from '@/contexts/tasks/application/ports/out/Notifier'
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
const EARLIER = new Date('2025-12-31T00:00:00Z')

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

const ackedAssignee = (taskId: string, userId: string): TaskAssignee =>
  TaskAssignee.rehydrate({
    taskId,
    userId,
    seenAt: EARLIER,
    readAt: EARLIER,
    acknowledgedAt: EARLIER,
    snoozedUntil: null,
    createdAt: EARLIER,
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
    if (!this.store.includes(assignee)) this.store.push(assignee)
  }
}

class RecordingNotifier implements Notifier {
  readonly notifications: NotifyRequest[] = []
  async notify(request: NotifyRequest): Promise<void> {
    this.notifications.push(request)
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
  const notifier = new RecordingNotifier()
  const events = new RecordingPublisher()
  const service = new AcknowledgeTaskService(tasks, assignees, notifier, events, fixedClock(NOW))
  return { tasks, assignees, notifier, events, service }
}

describe('AcknowledgeTaskService', () => {
  it('fails with "Not an assignee" when the user has no assignment', async () => {
    const { tasks, service } = setup()
    await tasks.save(taskInStatus('t1', 'pending', 'creator'))
    const r = await service.execute({ id: 't1', userId: 'stranger' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('Not an assignee')
  })

  it('the sole assignee ack flips the task to acknowledged and notifies the creator', async () => {
    const { tasks, assignees, notifier, service } = setup()
    await tasks.save(taskInStatus('t1', 'pending', 'creator'))
    assignees.store.push(TaskAssignee.create('t1', 'alice', NOW))

    const r = await service.execute({ id: 't1', userId: 'alice' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.allAcked).toBe(true)
    expect(tasks.store.get('t1')?.status).toBe('acknowledged')
    expect(notifier.notifications).toEqual([
      { userId: 'creator', kind: 'task_acknowledged', title: 'A task', taskId: 't1' },
    ])
  })

  it('one of several assignees acking leaves the task pending (allAcked false)', async () => {
    const { tasks, assignees, service } = setup()
    await tasks.save(taskInStatus('t1', 'pending', 'creator'))
    assignees.store.push(TaskAssignee.create('t1', 'alice', NOW))
    assignees.store.push(TaskAssignee.create('t1', 'bob', NOW))

    const r = await service.execute({ id: 't1', userId: 'alice' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.allAcked).toBe(false)
    expect(tasks.store.get('t1')?.status).toBe('pending')
  })

  it('the final outstanding ack flips the task (other assignee already acked)', async () => {
    const { tasks, assignees, service } = setup()
    await tasks.save(taskInStatus('t1', 'pending', 'creator'))
    assignees.store.push(ackedAssignee('t1', 'alice'))
    assignees.store.push(TaskAssignee.create('t1', 'bob', NOW))

    const r = await service.execute({ id: 't1', userId: 'bob' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.allAcked).toBe(true)
    expect(tasks.store.get('t1')?.status).toBe('acknowledged')
  })

  it('does not self-notify when the creator acks their own task', async () => {
    const { tasks, assignees, notifier, service } = setup()
    await tasks.save(taskInStatus('t1', 'pending', 'creator'))
    assignees.store.push(TaskAssignee.create('t1', 'creator', NOW))

    const r = await service.execute({ id: 't1', userId: 'creator' })
    expect(r.ok).toBe(true)
    expect(notifier.notifications).toHaveLength(0)
  })
})
