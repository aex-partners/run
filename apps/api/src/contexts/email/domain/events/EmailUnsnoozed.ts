import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class EmailUnsnoozed implements DomainEvent {
  readonly name = 'email.EmailUnsnoozed'
  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date,
  ) {}
}
