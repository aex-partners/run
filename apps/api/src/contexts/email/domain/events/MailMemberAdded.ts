import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class MailMemberAdded implements DomainEvent {
  readonly name = 'email.MailMemberAdded'
  constructor(
    public readonly aggregateId: string,
    public readonly accountId: string,
    public readonly userId: string,
    public readonly canSend: boolean,
    public readonly occurredAt: Date,
  ) {}
}
