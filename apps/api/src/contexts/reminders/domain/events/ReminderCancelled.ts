import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class ReminderCancelled implements DomainEvent {
  readonly name = 'reminders.ReminderCancelled'
  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date,
  ) {}
}
