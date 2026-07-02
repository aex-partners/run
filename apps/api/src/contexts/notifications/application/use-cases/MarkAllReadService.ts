import { Result, ok } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { MarkAllRead, MarkAllReadCommand } from '@/contexts/notifications/application/ports/in/MarkAllRead'
import { NotificationRepository } from '@/contexts/notifications/application/ports/out/NotificationRepository'
import { UserId } from '@/contexts/notifications/domain/ids'

// Set-based bulk transition. The "mark every unread read" intent is expressed
// once against the repository rather than rehydrating each aggregate.
export class MarkAllReadService implements MarkAllRead {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: MarkAllReadCommand): Promise<Result<{ success: true }>> {
    await this.notifications.markAllReadForUser(UserId.of(cmd.userId), this.clock.now())
    return ok({ success: true })
  }
}
