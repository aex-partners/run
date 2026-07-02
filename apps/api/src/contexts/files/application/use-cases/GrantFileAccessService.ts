import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'
import { GrantFileAccess, GrantFileAccessInput } from '@/contexts/files/application/ports/in/GrantFileAccess'
import { FileShareRepository } from '@/contexts/files/application/ports/out/FileShareRepository'
import { FileShare } from '@/contexts/files/domain/FileShare'
import { FileId } from '@/contexts/files/domain/ids'

// Driven by the conversations context's attachment ACL. Upserts a FileShare for
// each file×user pair so chat members can reach attachments, reusing the domain
// FileShare aggregate (create / changeAccess) rather than writing rows directly.
// Idempotent: an existing grant at the requested access is left untouched.
export class GrantFileAccessService implements GrantFileAccess {
  constructor(
    private readonly shares: FileShareRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(input: GrantFileAccessInput): Promise<void> {
    const access = input.access ?? 'viewer'
    const now = this.clock.now()
    const events: DomainEvent[] = []

    for (const rawFileId of input.fileIds) {
      const fileId = FileId.of(rawFileId)
      for (const userId of input.userIds) {
        const existing = await this.shares.findByFileAndUser(fileId, userId)
        if (existing) {
          if (existing.access !== access) {
            existing.changeAccess(access, now)
            await this.shares.save(existing)
            events.push(...existing.pullEvents())
          }
        } else {
          const share = FileShare.create(this.shares.nextId(), fileId, userId, access, now)
          await this.shares.save(share)
          events.push(...share.pullEvents())
        }
      }
    }

    if (events.length > 0) await this.events.publish(events)
  }
}
