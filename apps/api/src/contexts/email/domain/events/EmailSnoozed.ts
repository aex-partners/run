import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class EmailSnoozed implements DomainEvent {
  readonly name = 'email.EmailSnoozed'
  constructor(
    public readonly aggregateId: string,
    public readonly until: Date,
    public readonly occurredAt: Date,
  ) {}
}
