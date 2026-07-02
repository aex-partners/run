import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class UserRoleChanged implements DomainEvent {
  readonly name = 'identity.UserRoleChanged'
  constructor(
    public readonly aggregateId: string,
    public readonly from: string,
    public readonly to: string,
    public readonly occurredAt: Date,
  ) {}
}
