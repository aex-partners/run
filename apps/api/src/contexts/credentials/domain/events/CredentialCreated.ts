import { DomainEvent } from '@/shared/kernel/DomainEvent'
import { CredentialType } from '@/contexts/credentials/domain/CredentialType'

export class CredentialCreated implements DomainEvent {
  readonly name = 'credentials.CredentialCreated'
  constructor(
    public readonly aggregateId: string,
    public readonly pluginName: string,
    public readonly type: CredentialType,
    public readonly occurredAt: Date,
  ) {}
}
