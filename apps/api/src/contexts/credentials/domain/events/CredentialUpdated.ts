import { DomainEvent } from '@/shared/kernel/DomainEvent'
import { CredentialStatus } from '@/contexts/credentials/domain/CredentialStatus'

export class CredentialUpdated implements DomainEvent {
  readonly name = 'credentials.CredentialUpdated'
  constructor(
    public readonly aggregateId: string,
    public readonly status: CredentialStatus,
    public readonly occurredAt: Date,
  ) {}
}
