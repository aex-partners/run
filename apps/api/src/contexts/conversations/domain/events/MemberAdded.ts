import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class MemberAdded implements DomainEvent {
  readonly name = 'conversations.MemberAdded'
  constructor(
    public readonly aggregateId: string,
    public readonly userId: string,
    public readonly occurredAt: Date,
  ) {}
}
