import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class UserStatusChanged implements DomainEvent {
  readonly name = 'identity.UserStatusChanged'
  constructor(
    public readonly aggregateId: string,
    public readonly status: 'active' | 'inactive',
    public readonly occurredAt: Date,
  ) {}
}
