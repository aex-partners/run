import { ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { RenameFile, RenameFileCommand } from '@/contexts/files/application/ports/in/RenameFile'
import { FileRepository } from '@/contexts/files/application/ports/out/FileRepository'
import { FileId } from '@/contexts/files/domain/ids'

export class RenameFileService implements RenameFile {
  constructor(
    private readonly files: FileRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: RenameFileCommand) {
    const file = await this.files.findById(FileId.of(cmd.id))
    if (!file) return fail('RenameFile: file not found')

    const renamed = file.rename(cmd.name, this.clock.now())
    if (!renamed.ok) return fail(renamed.error)

    await this.files.save(file)
    await this.events.publish(file.pullEvents())
    return ok({ success: true as const })
  }
}
