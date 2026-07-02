import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class CredentialDeleted implements DomainEvent {
  readonly name = 'credentials.CredentialDeleted'
  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date,
  ) {}
}
