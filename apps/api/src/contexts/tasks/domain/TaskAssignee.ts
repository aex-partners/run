import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { Result, ok, fail } from '@/shared/kernel/Result'
import { TaskAssigneeId, TaskId } from '@/contexts/tasks/domain/ids'
import { AssigneeAcknowledged } from '@/contexts/tasks/domain/events/AssigneeAcknowledged'

interface TaskAssigneeProps {
  taskId: string
  userId: string
  seenAt: Date | null
  readAt: Date | null
  acknowledgedAt: Date | null
  snoozedUntil: Date | null
  createdAt: Date
}

// AGGREGATE. Per-assignee responsibility + interaction state for a task. A task
// has many assignees; each tracks its own seen/read/acknowledged/snoozed state
// independently. Every transition is PURE.
export class TaskAssignee extends AggregateRoot<TaskAssigneeId> {
  private constructor(private props: TaskAssigneeProps) {
    super(TaskAssigneeId.of(props.taskId, props.userId))
  }

  static create(taskId: string, userId: string, now: Date): TaskAssignee {
    return new TaskAssignee({
      taskId,
      userId,
      seenAt: null,
      readAt: null,
      acknowledgedAt: null,
      snoozedUntil: null,
      createdAt: now,
    })
  }

  static rehydrate(props: TaskAssigneeProps): TaskAssignee {
    return new TaskAssignee({ ...props })
  }

  get taskId(): string {
    return this.props.taskId
  }

  get userId(): string {
    return this.props.userId
  }

  get seenAt(): Date | null {
    return this.props.seenAt
  }

  get readAt(): Date | null {
    return this.props.readAt
  }

  get acknowledgedAt(): Date | null {
    return this.props.acknowledgedAt
  }

  get snoozedUntil(): Date | null {
    return this.props.snoozedUntil
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  isAcknowledged(): boolean {
    return this.props.acknowledgedAt !== null
  }

  // PURE transition. Acknowledging implies the assignee has also seen and read
  // it: seen/read are backfilled to `now` only if not already set (matches AEX's
  // `readAt ?? now`, `seenAt ?? now`). Idempotent.
  acknowledge(now: Date): Result<void> {
    if (this.props.acknowledgedAt !== null) return ok(undefined)
    this.props.acknowledgedAt = now
    this.props.readAt = this.props.readAt ?? now
    this.props.seenAt = this.props.seenAt ?? now
    this.addEvent(new AssigneeAcknowledged(this.id.value, this.props.taskId, this.props.userId, now))
    return ok(undefined)
  }

  // PURE transition. Snooze this assignee's view of the task until `until`.
  snooze(until: Date): Result<void> {
    this.props.snoozedUntil = until
    return ok(undefined)
  }
}
