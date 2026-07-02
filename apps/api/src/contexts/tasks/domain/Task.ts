import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { Result, ok, fail } from '@/shared/kernel/Result'
import { TaskId } from '@/contexts/tasks/domain/ids'
import { TaskStatus, ApprovalDecision } from '@/contexts/tasks/domain/TaskStatus'
import { TaskKind } from '@/contexts/tasks/domain/TaskKind'
import { TaskExecutor } from '@/contexts/tasks/domain/TaskExecutor'
import { TaskType } from '@/contexts/tasks/domain/TaskType'
import { TaskCreated } from '@/contexts/tasks/domain/events/TaskCreated'
import { TaskStarted } from '@/contexts/tasks/domain/events/TaskStarted'
import { TaskCompleted } from '@/contexts/tasks/domain/events/TaskCompleted'
import { TaskFailed } from '@/contexts/tasks/domain/events/TaskFailed'
import { TaskCancelled } from '@/contexts/tasks/domain/events/TaskCancelled'
import { TaskAcknowledged } from '@/contexts/tasks/domain/events/TaskAcknowledged'
import { TaskSnoozed } from '@/contexts/tasks/domain/events/TaskSnoozed'
import { TaskApprovalDecided } from '@/contexts/tasks/domain/events/TaskApprovalDecided'

interface TaskProps {
  title: string
  description: string | null
  status: TaskStatus
  progress: number
  conversationId: string | null
  createdBy: string
  result: string | null
  error: string | null
  input: string | null
  scheduledAt: Date | null
  type: TaskType
  agentId: string | null
  toolName: string | null
  inputSchema: string | null
  outputSchema: string | null
  structuredInput: string | null
  executor: TaskExecutor
  kind: TaskKind
  dueAt: Date | null
  snoozedUntil: Date | null
  parentTaskId: string | null
  approvalDecision: ApprovalDecision | null
  createdAt: Date
  startedAt: Date | null
  completedAt: Date | null
}

export interface CreateTaskProps {
  id: TaskId
  title: string
  description: string | null
  kind: TaskKind
  executor: TaskExecutor
  type: TaskType
  createdBy: string
  conversationId: string | null
  input: string | null
  dueAt: Date | null
  parentTaskId: string | null
  agentId: string | null
  toolName: string | null
  inputSchema: string | null
  outputSchema: string | null
  structuredInput: string | null
  now: Date
}

export interface RehydrateTaskProps extends TaskProps {
  id: TaskId
}

// THE AGGREGATE. A task is a unit of work with a full lifecycle state machine:
//
//   pending --start--> running --complete--> completed
//                              --fail-----> failed
//                              --cancelDuringRun--> cancelled
//   pending|running --cancel--> cancelled
//   pending|running --acknowledge--> acknowledged
//   pending|running --approve/reject--> acknowledged (+ approvalDecision)
//
// completed | failed | cancelled | acknowledged are terminal. Every transition
// is PURE: it guards the invariant, mutates in-memory state, and records an
// event. All IO (persistence, queue, agent run, notifications) lives in the use
// cases. The WS broadcasts AEX did inline are now those events.
export class Task extends AggregateRoot<TaskId> {
  private constructor(
    id: TaskId,
    private props: TaskProps,
  ) {
    super(id)
  }

  // Factory for a freshly created task (AEX `tasks.create`). Born `pending` with
  // 0 progress. The only invariant guarded here is a non-empty title.
  static create(p: CreateTaskProps): Result<Task> {
    const title = p.title.trim()
    if (title.length < 1) return fail('Task: title is required')

    const task = new Task(p.id, {
      title,
      description: p.description,
      status: 'pending',
      progress: 0,
      conversationId: p.conversationId,
      createdBy: p.createdBy,
      result: null,
      error: null,
      input: p.input,
      scheduledAt: null,
      type: p.type,
      agentId: p.agentId,
      toolName: p.toolName,
      inputSchema: p.inputSchema,
      outputSchema: p.outputSchema,
      structuredInput: p.structuredInput,
      executor: p.executor,
      kind: p.kind,
      dueAt: p.dueAt,
      snoozedUntil: null,
      parentTaskId: p.parentTaskId,
      approvalDecision: null,
      createdAt: p.now,
      startedAt: null,
      completedAt: null,
    })
    task.addEvent(new TaskCreated(p.id.value, title, p.kind.value, p.executor.value, p.createdBy, p.now))
    return ok(task)
  }

  // AEX `tasks.retry`: clone the original into a new pending task owned by the
  // retrier. AEX's retry insert omits kind/executor, so they fall back to the DB
  // defaults (kind=task, executor=ai) — replicated here.
  static createFrom(original: Task, newId: TaskId, createdBy: string, now: Date): Result<Task> {
    return Task.create({
      id: newId,
      title: original.props.title,
      description: original.props.description,
      kind: TaskKind.task(),
      executor: TaskExecutor.ai(),
      type: original.props.type,
      createdBy,
      conversationId: original.props.conversationId,
      input: original.props.input,
      dueAt: null,
      parentTaskId: null,
      agentId: original.props.agentId,
      toolName: original.props.toolName,
      inputSchema: original.props.inputSchema,
      outputSchema: original.props.outputSchema,
      structuredInput: original.props.structuredInput,
      now,
    })
  }

  // Rehydrate from persistence: no events, no re-validation of stored data.
  static rehydrate(p: RehydrateTaskProps): Task {
    const { id, ...props } = p
    return new Task(id, { ...props })
  }

  // --- getters ---
  get title(): string {
    return this.props.title
  }
  get description(): string | null {
    return this.props.description
  }
  get status(): TaskStatus {
    return this.props.status
  }
  get progress(): number {
    return this.props.progress
  }
  get conversationId(): string | null {
    return this.props.conversationId
  }
  get createdBy(): string {
    return this.props.createdBy
  }
  get result(): string | null {
    return this.props.result
  }
  get error(): string | null {
    return this.props.error
  }
  get input(): string | null {
    return this.props.input
  }
  get scheduledAt(): Date | null {
    return this.props.scheduledAt
  }
  get type(): TaskType {
    return this.props.type
  }
  get agentId(): string | null {
    return this.props.agentId
  }
  get toolName(): string | null {
    return this.props.toolName
  }
  get inputSchema(): string | null {
    return this.props.inputSchema
  }
  get outputSchema(): string | null {
    return this.props.outputSchema
  }
  get structuredInput(): string | null {
    return this.props.structuredInput
  }
  get executor(): TaskExecutor {
    return this.props.executor
  }
  get kind(): TaskKind {
    return this.props.kind
  }
  get dueAt(): Date | null {
    return this.props.dueAt
  }
  get snoozedUntil(): Date | null {
    return this.props.snoozedUntil
  }
  get parentTaskId(): string | null {
    return this.props.parentTaskId
  }
  get approvalDecision(): ApprovalDecision | null {
    return this.props.approvalDecision
  }
  get createdAt(): Date {
    return this.props.createdAt
  }
  get startedAt(): Date | null {
    return this.props.startedAt
  }
  get completedAt(): Date | null {
    return this.props.completedAt
  }

  // --- pure transitions ---

  // pending -> running. The unattended runner marks the task running before it
  // begins the agentic loop.
  start(now: Date): Result<void> {
    if (this.props.status !== 'pending') {
      return fail(`Task: cannot start a ${this.props.status} task`)
    }
    this.props.status = 'running'
    this.props.startedAt = now
    this.addEvent(new TaskStarted(this.id.value, this.props.title, this.props.progress, now))
    return ok(undefined)
  }

  // running -> completed. Progress jumps to 100 and the result text is stored.
  complete(result: string, now: Date): Result<void> {
    if (this.props.status !== 'running') {
      return fail(`Task: cannot complete a ${this.props.status} task`)
    }
    this.props.status = 'completed'
    this.props.result = result
    this.props.progress = 100
    this.props.completedAt = now
    this.addEvent(new TaskCompleted(this.id.value, this.props.title, this.props.progress, now))
    return ok(undefined)
  }

  // running -> failed. Records the error message.
  fail(error: string, now: Date): Result<void> {
    if (this.props.status !== 'running') {
      return fail(`Task: cannot fail a ${this.props.status} task`)
    }
    this.props.status = 'failed'
    this.props.error = error
    this.props.completedAt = now
    this.addEvent(new TaskFailed(this.id.value, this.props.title, this.props.progress, error, now))
    return ok(undefined)
  }

  // running -> cancelled. AEX path when the runner raises TaskCancelledException:
  // status flips to cancelled with error cleared (the cancellation is not a
  // failure).
  cancelDuringRun(now: Date): Result<void> {
    if (this.props.status !== 'running') {
      return fail(`Task: cannot cancel a ${this.props.status} task`)
    }
    this.props.status = 'cancelled'
    this.props.error = null
    this.props.completedAt = now
    this.addEvent(new TaskCancelled(this.id.value, this.props.title, this.props.progress, now))
    return ok(undefined)
  }

  // pending|running -> cancelled. User-initiated cancel from the board (AEX
  // `tasks.cancel`).
  cancel(now: Date): Result<void> {
    if (this.props.status !== 'pending' && this.props.status !== 'running') {
      return fail(`Cannot cancel task with status: ${this.props.status}`)
    }
    this.props.status = 'cancelled'
    this.props.completedAt = now
    this.addEvent(new TaskCancelled(this.id.value, this.props.title, this.props.progress, now))
    return ok(undefined)
  }

  // -> acknowledged. AEX flips the task to acknowledged once EVERY assignee has
  // acked. Idempotent: acking an already-acknowledged task is a no-op.
  acknowledge(now: Date): Result<void> {
    if (this.props.status === 'acknowledged') return ok(undefined)
    if (this.props.status === 'cancelled' || this.props.status === 'failed') {
      return fail(`Task: cannot acknowledge a ${this.props.status} task`)
    }
    this.props.status = 'acknowledged'
    this.props.completedAt = now
    this.addEvent(new TaskAcknowledged(this.id.value, this.props.title, this.props.progress, now))
    return ok(undefined)
  }

  // Snooze: park the task until `until`. Mirrors AEX, which writes both
  // snoozedUntil and scheduledAt so the re-fire is scheduled at the snooze
  // target. Does not change status.
  snooze(until: Date, now: Date): Result<void> {
    if (this.props.status !== 'pending' && this.props.status !== 'running') {
      return fail(`Task: cannot snooze a ${this.props.status} task`)
    }
    this.props.snoozedUntil = until
    this.props.scheduledAt = until
    this.addEvent(new TaskSnoozed(this.id.value, this.props.title, until, now))
    return ok(undefined)
  }

  // Approval decision for a kind=approval task. Records the decision and closes
  // the task (acknowledged). Pure transition; guarded once per task.
  approve(now: Date): Result<void> {
    return this.decide('approved', now)
  }

  reject(now: Date): Result<void> {
    return this.decide('rejected', now)
  }

  private decide(decision: ApprovalDecision, now: Date): Result<void> {
    if (this.props.kind.value !== 'approval') {
      return fail('Task: only an approval task can be approved or rejected')
    }
    if (this.props.approvalDecision !== null) {
      return fail(`Task: already ${this.props.approvalDecision}`)
    }
    if (this.props.status === 'cancelled' || this.props.status === 'failed') {
      return fail(`Task: cannot decide a ${this.props.status} task`)
    }
    this.props.approvalDecision = decision
    this.props.status = 'acknowledged'
    this.props.completedAt = now
    this.addEvent(new TaskApprovalDecided(this.id.value, decision, now))
    return ok(undefined)
  }
}
