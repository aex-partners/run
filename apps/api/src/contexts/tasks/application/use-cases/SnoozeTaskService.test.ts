import { describe, it, expect } from 'vitest'
import { SnoozeTaskService } from '@/contexts/tasks/application/use-cases/SnoozeTaskService'
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
const UNTIL_ISO = '2026-01-03T00:00:00.000Z'

const taskInStatus = (id: string, status: TaskStatus): Task =>
  Task.rehydrate({
    id: TaskId.of(id),
    title: 'A task',
    description: null,
    status,
    progress: 0,
    conversationId: null,
    createdBy: 'creator',
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
  async save(): Promise<void> {}
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
  const service = new SnoozeTaskService(tasks, assignees, scheduler, events, fixedClock(NOW))
  return { tasks, assignees, scheduler, events, service }
}

describe('SnoozeTaskService', () => {
  it('fails with "Not an assignee" when the user has no assignment', async () => {
    const { service } = setup()
    const r = await service.execute({ id: 't1', userId: 'stranger', until: UNTIL_ISO })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('Not an assignee')
  })

  it('snoozes the assignee + task and re-schedules the job (cancel then schedule)', async () => {
    const { tasks, assignees, scheduler, events, service } = setup()
    await tasks.save(taskInStatus('t1', 'pending'))
    const assignment = TaskAssignee.create('t1', 'alice', NOW)
    assignees.store.push(assignment)

    const r = await service.execute({ id: 't1', userId: 'alice', until: UNTIL_ISO })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.until).toBe(UNTIL_ISO)

    const until = new Date(UNTIL_ISO)
    expect(assignment.snoozedUntil).toEqual(until)
    const task = tasks.store.get('t1')
    expect(task?.snoozedUntil).toEqual(until)
    expect(task?.scheduledAt).toEqual(until)

    expect(scheduler.calls).toEqual([
      { op: 'cancel', jobId: 't1' },
      { op: 'schedule', jobId: 't1', runAt: until },
    ])
    expect(events.events.map((e) => e.name)).toContain('tasks.TaskSnoozed')
  })

  it('fails with "Task not found" when the assignment exists but the task is missing', async () => {
    const { assignees, scheduler, service } = setup()
    assignees.store.push(TaskAssignee.create('t1', 'alice', NOW))
    const r = await service.execute({ id: 't1', userId: 'alice', until: UNTIL_ISO })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('Task not found')
    expect(scheduler.calls).toHaveLength(0)
  })

  it('fails when the task is terminal (snooze transition guarded)', async () => {
    const { tasks, assignees, scheduler, service } = setup()
    await tasks.save(taskInStatus('t1', 'completed'))
    assignees.store.push(TaskAssignee.create('t1', 'alice', NOW))
    const r = await service.execute({ id: 't1', userId: 'alice', until: UNTIL_ISO })
    expect(r.ok).toBe(false)
    expect(scheduler.calls).toHaveLength(0)
  })
})
