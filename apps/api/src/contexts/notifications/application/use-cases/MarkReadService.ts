import { Result, ok } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { MarkRead, MarkReadCommand } from '@/contexts/notifications/application/ports/in/MarkRead'
import { NotificationRepository } from '@/contexts/notifications/application/ports/out/NotificationRepository'
import { NotificationId } from '@/contexts/notifications/domain/ids'

// Loads the aggregate, enforces ownership, applies the read-once transition,
// persists, publishes. Ownership mismatch / missing id is a silent success,
// matching AEX's user-scoped UPDATE that simply affects zero rows.
export class MarkReadService implements MarkRead {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: MarkReadCommand): Promise<Result<{ success: true }>> {
    const notification = await this.notifications.findById(NotificationId.of(cmd.id))
    if (!notification || notification.userId.value !== cmd.userId) {
      return ok({ success: true })
    }

    notification.markRead(this.clock.now())
    await this.notifications.save(notification)
    await this.events.publish(notification.pullEvents())
    return ok({ success: true })
  }
}
