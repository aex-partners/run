import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class FolderCreated implements DomainEvent {
  readonly name = 'files.FolderCreated'
  constructor(
    public readonly aggregateId: string,
    public readonly ownerId: string,
    public readonly folderName: string,
    public readonly parentId: string | null,
    public readonly occurredAt: Date,
  ) {}
}
