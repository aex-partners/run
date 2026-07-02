import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class CredentialRefreshed implements DomainEvent {
  readonly name = 'credentials.CredentialRefreshed'
  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date,
  ) {}
}
