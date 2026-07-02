import { ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { ShareFile, ShareFileCommand } from '@/contexts/files/application/ports/in/ShareFile'
import { FileShareRepository } from '@/contexts/files/application/ports/out/FileShareRepository'
import { UserDirectory } from '@/contexts/files/application/ports/out/UserDirectory'
import { FileShare } from '@/contexts/files/domain/FileShare'
import { FileId } from '@/contexts/files/domain/ids'

// Resolves the grantee by email (UserDirectory ACL), rejects a duplicate grant,
// then records a new FileShare.
export class ShareFileService implements ShareFile {
  constructor(
    private readonly shares: FileShareRepository,
    private readonly users: UserDirectory,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: ShareFileCommand) {
    const userId = await this.users.findUserIdByEmail(cmd.email)
    if (!userId) return fail('ShareFile: user not found')

    const fileId = FileId.of(cmd.fileId)
    const existing = await this.shares.findByFileAndUser(fileId, userId)
    if (existing) return fail('ShareFile: already shared')

    const share = FileShare.create(this.shares.nextId(), fileId, userId, cmd.access, this.clock.now())
    await this.shares.save(share)
    await this.events.publish(share.pullEvents())
    return ok({ success: true as const })
  }
}
