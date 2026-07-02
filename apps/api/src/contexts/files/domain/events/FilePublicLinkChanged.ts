import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class FilePublicLinkChanged implements DomainEvent {
  readonly name = 'files.FilePublicLinkChanged'
  constructor(
    public readonly aggregateId: string,
    public readonly enabled: boolean,
    public readonly occurredAt: Date,
  ) {}
}
