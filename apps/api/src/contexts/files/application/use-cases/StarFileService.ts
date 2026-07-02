import { ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { StarFile, StarFileCommand } from '@/contexts/files/application/ports/in/StarFile'
import { FileRepository } from '@/contexts/files/application/ports/out/FileRepository'
import { FileId } from '@/contexts/files/domain/ids'

export class StarFileService implements StarFile {
  constructor(
    private readonly files: FileRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: StarFileCommand) {
    const file = await this.files.findById(FileId.of(cmd.id))
    if (!file) return fail('StarFile: file not found')

    file.toggleStar(this.clock.now())
    await this.files.save(file)
    await this.events.publish(file.pullEvents())
    return ok({ starred: file.starred })
  }
}
