import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class ReminderFired implements DomainEvent {
  readonly name = 'reminders.ReminderFired'
  constructor(
    public readonly aggregateId: string,
    public readonly userId: string,
    public readonly conversationId: string | null,
    public readonly message: string,
    public readonly occurredAt: Date,
  ) {}
}
