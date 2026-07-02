import { ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { MoveFile, MoveFileCommand } from '@/contexts/files/application/ports/in/MoveFile'
import { FileRepository } from '@/contexts/files/application/ports/out/FileRepository'
import { FileId } from '@/contexts/files/domain/ids'

export class MoveFileService implements MoveFile {
  constructor(
    private readonly files: FileRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: MoveFileCommand) {
    const file = await this.files.findById(FileId.of(cmd.id))
    if (!file) return fail('MoveFile: file not found')

    const moved = file.move(cmd.parentId ? FileId.of(cmd.parentId) : null, this.clock.now())
    if (!moved.ok) return fail(moved.error)

    await this.files.save(file)
    await this.events.publish(file.pullEvents())
    return ok({ success: true as const })
  }
}
