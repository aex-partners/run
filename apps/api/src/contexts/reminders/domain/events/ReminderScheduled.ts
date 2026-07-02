import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class ReminderScheduled implements DomainEvent {
  readonly name = 'reminders.ReminderScheduled'
  constructor(
    public readonly aggregateId: string,
    public readonly userId: string,
    public readonly conversationId: string | null,
    public readonly message: string,
    public readonly scheduledFor: Date,
    public readonly deliverEmail: boolean,
    public readonly occurredAt: Date,
  ) {}
}
