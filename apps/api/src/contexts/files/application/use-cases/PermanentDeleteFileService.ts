import { ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { PermanentDeleteFile, PermanentDeleteFileCommand } from '@/contexts/files/application/ports/in/PermanentDeleteFile'
import { FileRepository } from '@/contexts/files/application/ports/out/FileRepository'
import { FileStorage } from '@/contexts/files/application/ports/out/FileStorage'
import { FileId } from '@/contexts/files/domain/ids'

// Removes the bytes first, then the row. A folder carries no bytes, so its path
// is skipped (mirrors the source guard `path && isFolder === 0`).
export class PermanentDeleteFileService implements PermanentDeleteFile {
  constructor(
    private readonly files: FileRepository,
    private readonly storage: FileStorage,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: PermanentDeleteFileCommand) {
    const file = await this.files.findById(FileId.of(cmd.id))
    if (!file) return fail('PermanentDeleteFile: file not found')

    if (file.path && !file.isFolder) {
      await this.storage.delete(file.path)
    }
    file.markDeleted(this.clock.now())
    await this.files.delete(file)
    await this.events.publish(file.pullEvents())
    return ok({ success: true as const })
  }
}
