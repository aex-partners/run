import { ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { ChangeShareAccess, ChangeShareAccessCommand } from '@/contexts/files/application/ports/in/ChangeShareAccess'
import { FileShareRepository } from '@/contexts/files/application/ports/out/FileShareRepository'
import { FileId } from '@/contexts/files/domain/ids'

export class ChangeShareAccessService implements ChangeShareAccess {
  constructor(
    private readonly shares: FileShareRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: ChangeShareAccessCommand) {
    const share = await this.shares.findByFileAndUser(FileId.of(cmd.fileId), cmd.userId)
    if (!share) return fail('ChangeShareAccess: share not found')

    share.changeAccess(cmd.access, this.clock.now())
    await this.shares.save(share)
    await this.events.publish(share.pullEvents())
    return ok({ success: true as const })
  }
}
