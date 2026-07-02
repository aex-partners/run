import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class EmailSent implements DomainEvent {
  readonly name = 'email.EmailSent'
  constructor(
    public readonly aggregateId: string,
    public readonly accountId: string,
    public readonly to: readonly string[],
    public readonly subject: string,
    public readonly occurredAt: Date,
  ) {}
}
