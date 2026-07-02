import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class MailMemberRemoved implements DomainEvent {
  readonly name = 'email.MailMemberRemoved'
  constructor(
    public readonly aggregateId: string,
    public readonly accountId: string,
    public readonly userId: string,
    public readonly occurredAt: Date,
  ) {}
}
