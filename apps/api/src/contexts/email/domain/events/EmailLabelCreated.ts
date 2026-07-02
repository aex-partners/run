import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class EmailLabelCreated implements DomainEvent {
  readonly name = 'email.EmailLabelCreated'
  constructor(
    public readonly aggregateId: string,
    public readonly accountId: string,
    public readonly labelName: string,
    public readonly occurredAt: Date,
  ) {}
}
