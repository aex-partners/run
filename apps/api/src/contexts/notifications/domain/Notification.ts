import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { Result, ok, fail } from '@/shared/kernel/Result'
import { NotificationId, UserId, TaskId } from '@/contexts/notifications/domain/ids'
import { NotificationKind } from '@/contexts/notifications/domain/NotificationKind'
import { NotificationCreated } from '@/contexts/notifications/domain/events/NotificationCreated'
import { NotificationRead } from '@/contexts/notifications/domain/events/NotificationRead'

export interface CreateNotificationProps {
  id: NotificationId
  userId: UserId
  kind: NotificationKind
  title: string
  body: string | null
  taskId: TaskId | null
  now: Date
}

// AGGREGATE. A single conversation-independent notification on a user's inbox.
// Identity by id; it guards the one invariant it owns (a title is required) and
// the read-once transition. Everything else (kind validity, ids) is pre-built by
// VOs before it ever sees them.
export class Notification extends AggregateRoot<NotificationId> {
  private constructor(
    id: NotificationId,
    public readonly userId: UserId,
    private readonly _kind: NotificationKind,
    private readonly _title: string,
    private readonly _body: string | null,
    private readonly _taskId: TaskId | null,
    private _readAt: Date | null,
    public readonly createdAt: Date,
  ) {
    super(id)
  }

  static create(props: CreateNotificationProps): Result<Notification> {
    const title = props.title.trim()
    if (title.length < 1) return fail('Notification: title is required')
    const notification = new Notification(
      props.id,
      props.userId,
      props.kind,
      title,
      props.body,
      props.taskId,
      null,
      props.now,
    )
    notification.addEvent(
      new NotificationCreated(
        props.id.value,
        props.userId.value,
        props.kind.value,
        props.taskId?.value ?? null,
        props.now,
      ),
    )
    return ok(notification)
  }

  // Rehydrate from persistence: no events, no re-validation of stored data.
  static rehydrate(props: {
    id: NotificationId
    userId: UserId
    kind: NotificationKind
    title: string
    body: string | null
    taskId: TaskId | null
    readAt: Date | null
    createdAt: Date
  }): Notification {
    return new Notification(
      props.id,
      props.userId,
      props.kind,
      props.title,
      props.body,
      props.taskId,
      props.readAt,
      props.createdAt,
    )
  }

  // Idempotent: marking an already-read notification is a no-op and emits no
  // second event.
  markRead(now: Date): void {
    if (this._readAt) return
    this._readAt = now
    this.addEvent(new NotificationRead(this.id.value, this.userId.value, now))
  }

  isRead(): boolean {
    return this._readAt !== null
  }

  get kind(): NotificationKind {
    return this._kind
  }

  get title(): string {
    return this._title
  }

  get body(): string | null {
    return this._body
  }

  get taskId(): TaskId | null {
    return this._taskId
  }

  get readAt(): Date | null {
    return this._readAt
  }
}
