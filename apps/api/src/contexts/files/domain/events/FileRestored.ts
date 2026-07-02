import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class FileRestored implements DomainEvent {
  readonly name = 'files.FileRestored'
  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date,
  ) {}
}
