import { ok } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { UnshareFile, UnshareFileCommand } from '@/contexts/files/application/ports/in/UnshareFile'
import { FileShareRepository } from '@/contexts/files/application/ports/out/FileShareRepository'
import { FileId } from '@/contexts/files/domain/ids'

// Idempotent, matching the source: removing an absent share is a no-op success.
export class UnshareFileService implements UnshareFile {
  constructor(
    private readonly shares: FileShareRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: UnshareFileCommand) {
    const share = await this.shares.findByFileAndUser(FileId.of(cmd.fileId), cmd.userId)
    if (share) {
      share.revoke(this.clock.now())
      await this.shares.delete(share)
      await this.events.publish(share.pullEvents())
    }
    return ok({ success: true as const })
  }
}
