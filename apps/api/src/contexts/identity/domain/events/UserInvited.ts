import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class UserInvited implements DomainEvent {
  readonly name = 'identity.UserInvited'
  constructor(
    public readonly aggregateId: string,
    public readonly email: string,
    public readonly userName: string,
    public readonly occurredAt: Date,
  ) {}
}
