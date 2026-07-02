import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class FileRenamed implements DomainEvent {
  readonly name = 'files.FileRenamed'
  constructor(
    public readonly aggregateId: string,
    public readonly fileName: string,
    public readonly occurredAt: Date,
  ) {}
}
