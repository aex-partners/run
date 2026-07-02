import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class EmailReadChanged implements DomainEvent {
  readonly name = 'email.EmailReadChanged'
  constructor(
    public readonly aggregateId: string,
    public readonly read: boolean,
    public readonly occurredAt: Date,
  ) {}
}
