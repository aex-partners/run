import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import {
  CreateNotification,
  CreateNotificationCommand,
} from '@/contexts/notifications/application/ports/in/CreateNotification'
import { NotificationRepository } from '@/contexts/notifications/application/ports/out/NotificationRepository'
import { Notification } from '@/contexts/notifications/domain/Notification'
import { NotificationKind } from '@/contexts/notifications/domain/NotificationKind'
import { UserId, TaskId } from '@/contexts/notifications/domain/ids'

// Application service. No business rule of its own: validates the kind VO, builds
// the aggregate (rules live in the factory), persists, publishes events. The
// NotificationCreated event is the hexagonal replacement for AEX's inline
// `sendToUser(notification_new)` WebSocket push.
export class CreateNotificationService implements CreateNotification {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: CreateNotificationCommand): Promise<Result<{ id: string }>> {
    const kind = NotificationKind.of(cmd.kind)
    if (!kind.ok) return fail(kind.error)

    const id = this.notifications.nextId()
    const notification = Notification.create({
      id,
      userId: UserId.of(cmd.userId),
      kind: kind.value,
      title: cmd.title,
      body: cmd.body ?? null,
      taskId: cmd.taskId ? TaskId.of(cmd.taskId) : null,
      now: this.clock.now(),
    })
    if (!notification.ok) return fail(notification.error)

    await this.notifications.save(notification.value)
    await this.events.publish(notification.value.pullEvents())
    return ok({ id: id.value })
  }
}
