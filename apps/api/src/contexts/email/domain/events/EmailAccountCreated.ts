import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class EmailAccountCreated implements DomainEvent {
  readonly name = 'email.EmailAccountCreated'
  constructor(
    public readonly aggregateId: string,
    public readonly ownerId: string,
    public readonly emailAddress: string,
    public readonly occurredAt: Date,
  ) {}
}
