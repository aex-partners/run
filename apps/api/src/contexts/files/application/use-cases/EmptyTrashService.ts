import { ok } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'
import { EmptyTrash, EmptyTrashCommand } from '@/contexts/files/application/ports/in/EmptyTrash'
import { FileRepository } from '@/contexts/files/application/ports/out/FileRepository'
import { FileStorage } from '@/contexts/files/application/ports/out/FileStorage'

// Deletes every trashed file owned by the caller, dropping each one's bytes
// before its row. Events are drained per file and published once at the end.
export class EmptyTrashService implements EmptyTrash {
  constructor(
    private readonly files: FileRepository,
    private readonly storage: FileStorage,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: EmptyTrashCommand) {
    const trashed = await this.files.findTrashedByOwner(cmd.ownerId)
    const now = this.clock.now()
    const drained: DomainEvent[] = []

    for (const file of trashed) {
      if (file.path && !file.isFolder) {
        await this.storage.delete(file.path)
      }
      file.markDeleted(now)
      await this.files.delete(file)
      drained.push(...file.pullEvents())
    }

    await this.events.publish(drained)
    return ok({ deleted: trashed.length })
  }
}
