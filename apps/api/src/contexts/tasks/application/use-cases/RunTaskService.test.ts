import { describe, it, expect } from 'vitest'
import { ok, fail } from '@/shared/kernel/Result'
import { RunTaskService } from '@/contexts/tasks/application/use-cases/RunTaskService'
import { TaskRepository } from '@/contexts/tasks/application/ports/out/TaskRepository'
import { TaskAssigneeRepository } from '@/contexts/tasks/application/ports/out/TaskAssigneeRepository'
import { TaskLogRepository } from '@/contexts/tasks/application/ports/out/TaskLogRepository'
import {
  AgentRunner,
  AgentToolDecision,
  AgentRunOutput,
  AgentRunFailure,
  InferenceRunRequest,
  StructuredRunRequest,
} from '@/contexts/tasks/application/ports/out/AgentRunner'
import { Notifier, NotifyRequest } from '@/contexts/tasks/application/ports/out/Notifier'
import {
  ConversationPoster,
  ConversationPostRequest,
} from '@/contexts/tasks/application/ports/out/ConversationPoster'
import { Result } from '@/shared/kernel/Result'
import { Task, CreateTaskProps } from '@/contexts/tasks/domain/Task'
import { TaskAssignee } from '@/contexts/tasks/domain/TaskAssignee'
import { TaskLog } from '@/contexts/tasks/domain/TaskLog'
import { TaskId, TaskLogId } from '@/contexts/tasks/domain/ids'
import { TaskKind } from '@/contexts/tasks/domain/TaskKind'
import { TaskExecutor } from '@/contexts/tasks/domain/TaskExecutor'
import { TaskType } from '@/contexts/tasks/domain/TaskType'
import { DEFAULT_TASK_BUDGET } from '@/contexts/tasks/domain/TaskBudget'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2026-01-01T00:00:00Z')

const reminderKind = (): TaskKind => {
  const r = TaskKind.of('reminder')
  if (!r.ok) throw new Error('reminder kind')
  return r.value
}

const makeTask = (over: Partial<CreateTaskProps> = {}): Task => {
  const r = Task.create({
    id: TaskId.of('t1'),
    title: 'My task',
    description: null,
    kind: TaskKind.task(),
    executor: TaskExecutor.ai(),
    type: TaskType.inference(),
    createdBy: 'creator',
    conversationId: 'conv-1',
    input: 'do the work',
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
  if (!r.ok) throw new Error('task must create')
  return r.value
}

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

class InMemoryLogRepo implements TaskLogRepository {
  private seq = 0
  readonly logs: TaskLog[] = []
  nextId(): TaskLogId {
    this.seq += 1
    return TaskLogId.of(`log-${this.seq}`)
  }
  async append(log: TaskLog): Promise<void> {
    this.logs.push(log)
  }
}

type InferenceImpl = (req: InferenceRunRequest) => Promise<Result<AgentRunOutput, AgentRunFailure>>
type StructuredImpl = (req: StructuredRunRequest) => Promise<Result<AgentRunOutput, AgentRunFailure>>

class FakeAgentRunner implements AgentRunner {
  lastInference?: InferenceRunRequest
  lastStructured?: StructuredRunRequest
  constructor(
    private readonly inferenceImpl?: InferenceImpl,
    private readonly structuredImpl?: StructuredImpl,
  ) {}
  async runInference(req: InferenceRunRequest): Promise<Result<AgentRunOutput, AgentRunFailure>> {
    this.lastInference = req
    return this.inferenceImpl ? this.inferenceImpl(req) : ok({ text: 'inference output' })
  }
  async runStructured(req: StructuredRunRequest): Promise<Result<AgentRunOutput, AgentRunFailure>> {
    this.lastStructured = req
    return this.structuredImpl ? this.structuredImpl(req) : ok({ text: 'structured output' })
  }
}

class RecordingNotifier implements Notifier {
  readonly notifications: NotifyRequest[] = []
  async notify(request: NotifyRequest): Promise<void> {
    this.notifications.push(request)
  }
}

class RecordingPoster implements ConversationPoster {
  readonly posts: ConversationPostRequest[] = []
  async post(request: ConversationPostRequest): Promise<void> {
    this.posts.push(request)
  }
}

class RecordingPublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.events.push(...events)
  }
}

const fixedClock = (now: Date): Clock => ({ now: () => now })

const setup = (runner: AgentRunner = new FakeAgentRunner()) => {
  const tasks = new InMemoryTaskRepo()
  const assignees = new InMemoryAssigneeRepo()
  const logs = new InMemoryLogRepo()
  const notifier = new RecordingNotifier()
  const poster = new RecordingPoster()
  const events = new RecordingPublisher()
  const service = new RunTaskService(
    tasks,
    assignees,
    logs,
    runner,
    notifier,
    poster,
    events,
    fixedClock(NOW),
    DEFAULT_TASK_BUDGET,
  )
  return { tasks, assignees, logs, notifier, poster, events, service }
}

describe('RunTaskService — skip paths', () => {
  it('is a no-op (ran:false) for a missing task', async () => {
    const { service } = setup()
    const r = await service.execute({ taskId: 'ghost' })
    expect(r.ok && r.value.ran).toBe(false)
  })

  it('is a no-op (ran:false) for a non-pending task', async () => {
    const { tasks, service } = setup()
    const task = makeTask()
    task.start(NOW) // -> running
    await tasks.save(task)
    const r = await service.execute({ taskId: 't1' })
    expect(r.ok && r.value.ran).toBe(false)
    expect(tasks.store.get('t1')?.status).toBe('running')
  })
})

describe('RunTaskService — surface (reminder / human), stays pending', () => {
  it('surfaces a reminder: posts a system message and notifies each assignee', async () => {
    const { tasks, assignees, poster, notifier, service } = setup()
    await tasks.save(makeTask({ kind: reminderKind() }))
    assignees.store.push(TaskAssignee.create('t1', 'alice', NOW))
    assignees.store.push(TaskAssignee.create('t1', 'bob', NOW))

    const r = await service.execute({ taskId: 't1' })
    expect(r.ok && r.value.ran).toBe(false)
    expect(tasks.store.get('t1')?.status).toBe('pending')
    expect(poster.posts).toHaveLength(1)
    expect(poster.posts[0]?.role).toBe('system')
    expect(poster.posts[0]?.content).toBe('Reminder: My task')
    expect(notifier.notifications.map((n) => n.kind)).toEqual(['reminder_fired', 'reminder_fired'])
  })

  it('surfaces a human-executor task without posting when there is no conversation', async () => {
    const { tasks, poster, service } = setup()
    await tasks.save(makeTask({ executor: TaskExecutor.human(), conversationId: null }))
    const r = await service.execute({ taskId: 't1' })
    expect(r.ok && r.value.ran).toBe(false)
    expect(tasks.store.get('t1')?.status).toBe('pending')
    expect(poster.posts).toHaveLength(0)
  })
})

describe('RunTaskService — inference path', () => {
  it('runs, completes, posts the AI summary, and writes start/finish logs', async () => {
    const { tasks, logs, poster, service } = setup()
    await tasks.save(makeTask())
    const r = await service.execute({ taskId: 't1' })
    expect(r.ok && r.value.ran).toBe(true)

    const task = tasks.store.get('t1')
    expect(task?.status).toBe('completed')
    expect(task?.result).toBe('inference output')

    expect(logs.logs.map((l) => l.message)).toEqual(['scheduled task starting', 'scheduled task finished'])
    expect(poster.posts).toEqual([
      { conversationId: 'conv-1', userId: 'creator', role: 'ai', content: 'inference output' },
    ])
  })

  it('uses a fallback result string when the agent returns empty text', async () => {
    const runner = new FakeAgentRunner(async () => ok({ text: '   ' }))
    const { tasks, service } = setup(runner)
    await tasks.save(makeTask())
    await service.execute({ taskId: 't1' })
    expect(tasks.store.get('t1')?.result).toBe('(scheduled task finished with no text output)')
  })

  it('flips to cancelled (no failure post) when the run is cancelled', async () => {
    const runner = new FakeAgentRunner(async () => fail<AgentRunOutput, AgentRunFailure>({ cancelled: true, message: 'stopped' }))
    const { tasks, poster, service } = setup(runner)
    await tasks.save(makeTask())
    const r = await service.execute({ taskId: 't1' })
    expect(r.ok && r.value.ran).toBe(true)
    expect(tasks.store.get('t1')?.status).toBe('cancelled')
    expect(poster.posts).toHaveLength(0)
  })

  it('fails and posts a failure message when the run fails (non-cancelled)', async () => {
    const runner = new FakeAgentRunner(async () => fail<AgentRunOutput, AgentRunFailure>({ cancelled: false, message: 'spend cap breached' }))
    const { tasks, poster, service } = setup(runner)
    await tasks.save(makeTask())
    const r = await service.execute({ taskId: 't1' })
    expect(r.ok && r.value.ran).toBe(true)
    const task = tasks.store.get('t1')
    expect(task?.status).toBe('failed')
    expect(task?.error).toBe('spend cap breached')
    expect(poster.posts).toHaveLength(1)
    expect(poster.posts[0]?.content).toMatch(/failed/)
  })

  it('fails fast when the inference task has no input prompt', async () => {
    const runner = new FakeAgentRunner()
    const { tasks, service } = setup(runner)
    await tasks.save(makeTask({ input: null }))
    const r = await service.execute({ taskId: 't1' })
    expect(r.ok && r.value.ran).toBe(true)
    expect(tasks.store.get('t1')?.status).toBe('failed')
    expect(runner.lastInference).toBeUndefined()
  })

  it('fails fast when the inference task has no conversation', async () => {
    const runner = new FakeAgentRunner()
    const { tasks, service } = setup(runner)
    await tasks.save(makeTask({ conversationId: null }))
    const r = await service.execute({ taskId: 't1' })
    expect(r.ok && r.value.ran).toBe(true)
    expect(tasks.store.get('t1')?.status).toBe('failed')
    expect(runner.lastInference).toBeUndefined()
  })
})

describe('RunTaskService — budget guard wiring', () => {
  it('allows readonly free, allows 5 mutations, denies the 6th, and logs each decision', async () => {
    const decisions: AgentToolDecision[] = []
    const runner = new FakeAgentRunner(async (req) => {
      decisions.push(await req.guard({ toolName: 'read_x', toolClass: 'readonly', input: {} }))
      for (let i = 0; i < 6; i++) {
        decisions.push(await req.guard({ toolName: 'update_x', toolClass: 'mutation', input: { i } }))
      }
      return ok({ text: 'guarded' })
    })
    const { tasks, logs, service } = setup(runner)
    await tasks.save(makeTask())
    await service.execute({ taskId: 't1' })

    expect(decisions[0]?.behavior).toBe('allow') // readonly
    expect(decisions.slice(1, 6).every((d) => d.behavior === 'allow')).toBe(true) // 5 mutations
    const sixth = decisions[6]
    expect(sixth?.behavior).toBe('deny')
    if (sixth?.behavior === 'deny') expect(sixth.message).toMatch(/Mutation budget exhausted/)

    // readonly is not logged; 5 allowed steps + 1 denied warn.
    expect(logs.logs.filter((l) => l.message === 'allowed update_x')).toHaveLength(5)
    expect(logs.logs.some((l) => l.level === 'warn' && l.message.includes('denied update_x'))).toBe(true)
    expect(tasks.store.get('t1')?.status).toBe('completed')
  })

  it('enforces the email sub-cap through the guard (1 email allowed, 2nd denied)', async () => {
    const decisions: AgentToolDecision[] = []
    const runner = new FakeAgentRunner(async (req) => {
      decisions.push(await req.guard({ toolName: 'send_email', toolClass: 'email', input: {} }))
      decisions.push(await req.guard({ toolName: 'send_email', toolClass: 'email', input: {} }))
      return ok({ text: 'emailed' })
    })
    const { tasks, service } = setup(runner)
    await tasks.save(makeTask())
    await service.execute({ taskId: 't1' })

    expect(decisions[0]?.behavior).toBe('allow')
    const second = decisions[1]
    expect(second?.behavior).toBe('deny')
    if (second?.behavior === 'deny') expect(second.message).toMatch(/send_email budget exhausted/)
  })
})

describe('RunTaskService — structured path', () => {
  it('runs the named tool and completes with no budget logs', async () => {
    const { tasks, logs, poster, service } = setup()
    await tasks.save(makeTask({ type: TaskType.structured(), toolName: 'crunch_numbers' }))
    const r = await service.execute({ taskId: 't1' })
    expect(r.ok && r.value.ran).toBe(true)
    expect(tasks.store.get('t1')?.status).toBe('completed')
    expect(tasks.store.get('t1')?.result).toBe('structured output')
    // No budget audit logs on the structured path.
    expect(logs.logs).toHaveLength(0)
    expect(poster.posts).toHaveLength(1)
  })

  it('fails fast when a structured task has no toolName', async () => {
    const runner = new FakeAgentRunner()
    const { tasks, service } = setup(runner)
    await tasks.save(makeTask({ type: TaskType.structured(), toolName: null }))
    const r = await service.execute({ taskId: 't1' })
    expect(r.ok && r.value.ran).toBe(true)
    expect(tasks.store.get('t1')?.status).toBe('failed')
    expect(runner.lastStructured).toBeUndefined()
  })
})
