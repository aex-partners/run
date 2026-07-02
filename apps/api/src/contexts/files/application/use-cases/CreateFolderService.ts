import { ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { CreateFolder, CreateFolderCommand } from '@/contexts/files/application/ports/in/CreateFolder'
import { FileRepository } from '@/contexts/files/application/ports/out/FileRepository'
import { File } from '@/contexts/files/domain/File'

export class CreateFolderService implements CreateFolder {
  constructor(
    private readonly files: FileRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: CreateFolderCommand) {
    const id = this.files.nextId()
    const folder = File.createFolder(id, cmd.name, cmd.ownerId, cmd.parentId ?? null, this.clock.now())
    if (!folder.ok) return fail(folder.error)

    await this.files.save(folder.value)
    await this.events.publish(folder.value.pullEvents())
    return ok({ id: id.value })
  }
}
