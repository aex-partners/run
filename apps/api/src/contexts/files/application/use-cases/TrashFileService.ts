import { ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { TrashFile, TrashFileCommand } from '@/contexts/files/application/ports/in/TrashFile'
import { FileRepository } from '@/contexts/files/application/ports/out/FileRepository'
import { FileId } from '@/contexts/files/domain/ids'

export class TrashFileService implements TrashFile {
  constructor(
    private readonly files: FileRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: TrashFileCommand) {
    const file = await this.files.findById(FileId.of(cmd.id))
    if (!file) return fail('TrashFile: file not found')

    file.trash(this.clock.now())
    await this.files.save(file)
    await this.events.publish(file.pullEvents())
    return ok({ success: true as const })
  }
}
