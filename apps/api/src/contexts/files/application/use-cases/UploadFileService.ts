import { ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { UploadFile, UploadFileCommand, UploadFileResult } from '@/contexts/files/application/ports/in/UploadFile'
import { FileRepository } from '@/contexts/files/application/ports/out/FileRepository'
import { FileStorage } from '@/contexts/files/application/ports/out/FileStorage'
import { File } from '@/contexts/files/domain/File'

// Persists bytes (storage port), then the File aggregate. The order matters: a
// failed write must not leave a dangling row. Depends only on ports.
export class UploadFileService implements UploadFile {
  constructor(
    private readonly files: FileRepository,
    private readonly storage: FileStorage,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: UploadFileCommand) {
    const path = await this.storage.save(cmd.bytes, cmd.name)
    const id = this.files.nextId()
    const file = File.upload(
      id,
      {
        name: cmd.name,
        size: cmd.bytes.length,
        path,
        source: cmd.source ?? 'upload',
        sourceRef: cmd.sourceRef ?? null,
        ownerId: cmd.ownerId,
        parentId: cmd.parentId ?? null,
      },
      this.clock.now(),
    )
    if (!file.ok) {
      // Roll back the orphaned bytes so storage never drifts from the table.
      await this.storage.delete(path)
      return fail(file.error)
    }

    await this.files.save(file.value)
    await this.events.publish(file.value.pullEvents())

    const result: UploadFileResult = {
      id: id.value,
      name: file.value.name,
      type: file.value.type,
      mimeType: file.value.mimeType,
      size: file.value.size,
      path,
    }
    return ok(result)
  }
}
