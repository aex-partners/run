import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { FireReminder, FireReminderCommand } from '@/contexts/reminders/application/ports/in/FireReminder'
import { ReminderRepository } from '@/contexts/reminders/application/ports/out/ReminderRepository'
import { ConversationPoster } from '@/contexts/reminders/application/ports/out/ConversationPoster'
import { ReminderId } from '@/contexts/reminders/domain/ids'

// Application service driven by the ReminderWorker at fire time.
//
// Crash-safety: the user-visible side-effect (posting into the conversation) is
// performed BEFORE the status flips to `fired` and is persisted. If the process
// dies between the post and the save, BullMQ retries the job; the reminder is
// still `scheduled` in the DB, so it re-posts and re-fires. The idempotent
// guards below skip a reminder that is already fired/cancelled or missing.
export class FireReminderService implements FireReminder {
  constructor(
    private readonly reminders: ReminderRepository,
    private readonly poster: ConversationPoster,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: FireReminderCommand): Promise<Result<{ fired: boolean }>> {
    const reminder = await this.reminders.findById(ReminderId.of(cmd.reminderId))
    if (!reminder) return ok({ fired: false })
    if (reminder.status !== 'scheduled') return ok({ fired: false })

    // Side-effect FIRST, then mark fired (see note above).
    const conversationId = reminder.conversationId
    if (conversationId) {
      await this.poster.post({
        conversationId,
        userId: reminder.userId,
        content: `Reminder: ${reminder.message}`,
      })
    }

    const transition = reminder.fire(this.clock.now())
    if (!transition.ok) return fail(transition.error)

    await this.reminders.save(reminder)
    await this.events.publish(reminder.pullEvents())

    return ok({ fired: true })
  }
}
