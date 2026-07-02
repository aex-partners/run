import { DomainEvent } from '@/shared/kernel/DomainEvent'

// Records the AI-indexing intent flip. The actual embedding work is triggered
// out-of-band via the FileIndexingQueue out-port (an ACL to the knowledge
// context), not by this event.
export class FileAiIndexChanged implements DomainEvent {
  readonly name = 'files.FileAiIndexChanged'
  constructor(
    public readonly aggregateId: string,
    public readonly enabled: boolean,
    public readonly occurredAt: Date,
  ) {}
}
