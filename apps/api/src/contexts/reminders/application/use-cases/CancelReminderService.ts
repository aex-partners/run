import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { CancelReminder, CancelReminderCommand } from '@/contexts/reminders/application/ports/in/CancelReminder'
import { ReminderRepository } from '@/contexts/reminders/application/ports/out/ReminderRepository'
import { Scheduler } from '@/contexts/reminders/application/ports/out/Scheduler'
import { ReminderId } from '@/contexts/reminders/domain/ids'

// Application service. Loads the reminder (scoped to its owner), applies the
// pure cancel transition, removes the delayed job, persists, publishes.
export class CancelReminderService implements CancelReminder {
  constructor(
    private readonly reminders: ReminderRepository,
    private readonly scheduler: Scheduler,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: CancelReminderCommand): Promise<Result<{ success: true }>> {
    const reminder = await this.reminders.findById(ReminderId.of(cmd.reminderId))
    if (!reminder || reminder.userId !== cmd.userId) return fail('Reminder not found')

    const transition = reminder.cancel(this.clock.now())
    if (!transition.ok) return fail(transition.error)

    if (reminder.jobId) await this.scheduler.cancel(reminder.jobId)
    await this.reminders.save(reminder)
    await this.events.publish(reminder.pullEvents())

    return ok({ success: true })
  }
}
