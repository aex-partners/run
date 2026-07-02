import { describe, it, expect } from 'vitest'
import { CreateTaskService } from '@/contexts/tasks/application/use-cases/CreateTaskService'
import { TaskRepository } from '@/contexts/tasks/application/ports/out/TaskRepository'
import { TaskAssigneeRepository } from '@/contexts/tasks/application/ports/out/TaskAssigneeRepository'
import { Notifier, NotifyRequest } from '@/contexts/tasks/application/ports/out/Notifier'
import { Task } from '@/contexts/tasks/domain/Task'
import { TaskAssignee } from '@/contexts/tasks/domain/TaskAssignee'
import { TaskId } from '@/contexts/tasks/domain/ids'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2026-01-01T00:00:00Z')

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
  const service = new CreateTaskService(tasks, assignees, notifier, events, fixedClock(NOW))
  return { tasks, assignees, notifier, events, service }
}

describe('CreateTaskService', () => {
  it('creates a human task (default kind), persists, assigns, notifies task_assigned', async () => {
    const { tasks, assignees, notifier, events, service } = setup()
    const r = await service.execute({
      createdBy: 'creator',
      title: 'Do the thing',
      assigneeIds: ['alice', 'bob'],
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return

    const task = tasks.store.get(r.value.id)
    expect(task?.status).toBe('pending')
    expect(task?.kind.value).toBe('task')
    expect(task?.executor.value).toBe('human')

    expect(assignees.store.map((a) => a.userId).sort()).toEqual(['alice', 'bob'])
    expect(notifier.notifications.map((n) => n.kind)).toEqual(['task_assigned', 'task_assigned'])
    expect(notifier.notifications.map((n) => n.userId).sort()).toEqual(['alice', 'bob'])
    expect(events.events.map((e) => e.name)).toContain('tasks.TaskCreated')
  })

  it('uses approval_requested notifications for an approval task', async () => {
    const { notifier, service } = setup()
    const r = await service.execute({
      createdBy: 'creator',
      title: 'Approve budget',
      assigneeIds: ['alice'],
      kind: 'approval',
    })
    expect(r.ok).toBe(true)
    expect(notifier.notifications.map((n) => n.kind)).toEqual(['approval_requested'])
  })

  it('dedupes assignees: one assignment and one notification per unique user', async () => {
    const { assignees, notifier, service } = setup()
    const r = await service.execute({
      createdBy: 'creator',
      title: 'Dedup me',
      assigneeIds: ['alice', 'alice', 'bob', 'alice'],
    })
    expect(r.ok).toBe(true)
    expect(assignees.store.map((a) => a.userId)).toEqual(['alice', 'bob'])
    expect(notifier.notifications).toHaveLength(2)
  })

  it('fails on an invalid kind without persisting anything', async () => {
    const { tasks, service } = setup()
    const r = await service.execute({
      createdBy: 'creator',
      title: 'Bad kind',
      assigneeIds: ['alice'],
      kind: 'nonsense',
    })
    expect(r.ok).toBe(false)
    expect(tasks.store.size).toBe(0)
  })

  it('fails on an empty title (aggregate invariant)', async () => {
    const { tasks, service } = setup()
    const r = await service.execute({
      createdBy: 'creator',
      title: '   ',
      assigneeIds: ['alice'],
    })
    expect(r.ok).toBe(false)
    expect(tasks.store.size).toBe(0)
  })
})
