import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { CreateReminder, CreateReminderCommand } from '@/contexts/reminders/application/ports/in/CreateReminder'
import { ReminderRepository } from '@/contexts/reminders/application/ports/out/ReminderRepository'
import { Scheduler } from '@/contexts/reminders/application/ports/out/Scheduler'
import { Reminder } from '@/contexts/reminders/domain/Reminder'

// Application service. The rules (non-empty message, future time) live in the
// aggregate factory. Here we build it, persist, schedule the delayed job, and
// publish events. Depends ONLY on ports. The delayed job is keyed by the
// reminder id, so jobId == id — one job per reminder.
export class CreateReminderService implements CreateReminder {
  constructor(
    private readonly reminders: ReminderRepository,
    private readonly scheduler: Scheduler,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: CreateReminderCommand): Promise<Result<{ id: string; scheduledFor: string; status: string }>> {
    const id = this.reminders.nextId()
    const reminder = Reminder.schedule({
      id,
      jobId: id.value,
      userId: cmd.userId,
      conversationId: cmd.conversationId,
      message: cmd.message,
      scheduledFor: cmd.scheduledFor,
      deliverEmail: cmd.deliverEmail,
      now: this.clock.now(),
    })
    if (!reminder.ok) return fail(reminder.error)

    // Persist first, then enqueue the delayed job (mirrors the source order).
    await this.reminders.save(reminder.value)
    await this.scheduler.schedule(id.value, cmd.scheduledFor)
    await this.events.publish(reminder.value.pullEvents())

    return ok({ id: id.value, scheduledFor: cmd.scheduledFor.toISOString(), status: 'scheduled' })
  }
}
