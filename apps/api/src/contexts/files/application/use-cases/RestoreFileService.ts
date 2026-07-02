import { ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { RestoreFile, RestoreFileCommand } from '@/contexts/files/application/ports/in/RestoreFile'
import { FileRepository } from '@/contexts/files/application/ports/out/FileRepository'
import { FileId } from '@/contexts/files/domain/ids'

export class RestoreFileService implements RestoreFile {
  constructor(
    private readonly files: FileRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: RestoreFileCommand) {
    const file = await this.files.findById(FileId.of(cmd.id))
    if (!file) return fail('RestoreFile: file not found')

    file.restore(this.clock.now())
    await this.files.save(file)
    await this.events.publish(file.pullEvents())
    return ok({ success: true as const })
  }
}
