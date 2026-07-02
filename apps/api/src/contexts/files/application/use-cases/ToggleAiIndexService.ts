import { ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { ToggleAiIndex, ToggleAiIndexCommand } from '@/contexts/files/application/ports/in/ToggleAiIndex'
import { FileRepository } from '@/contexts/files/application/ports/out/FileRepository'
import { FileIndexingQueue } from '@/contexts/files/application/ports/out/FileIndexingQueue'
import { FileId } from '@/contexts/files/domain/ids'

// Flips the AI-index flag and hands the actual embedding work to the indexing
// queue out-port (ACL toward knowledge).
export class ToggleAiIndexService implements ToggleAiIndex {
  constructor(
    private readonly files: FileRepository,
    private readonly indexing: FileIndexingQueue,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: ToggleAiIndexCommand) {
    const file = await this.files.findById(FileId.of(cmd.id))
    if (!file) return fail('ToggleAiIndex: file not found')

    file.setAiIndexed(cmd.enabled, this.clock.now())
    await this.files.save(file)
    await this.indexing.enqueue({
      fileId: file.id.value,
      ownerId: file.ownerId,
      action: cmd.enabled ? 'index' : 'deindex',
    })
    await this.events.publish(file.pullEvents())
    return ok({ aiIndexed: cmd.enabled })
  }
}
