import { Result, ok } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import {
  DeleteCredential,
  DeleteCredentialCommand,
} from '@/contexts/credentials/application/ports/in/DeleteCredential'
import { CredentialRepository } from '@/contexts/credentials/application/ports/out/CredentialRepository'
import { TokenCache } from '@/contexts/credentials/application/ports/out/TokenCache'
import { CredentialId } from '@/contexts/credentials/domain/ids'

// Application service. Owner-scoped delete; always invalidates the cache so a
// stale token can't outlive the row. Missing/non-owned id is a silent no-op.
export class DeleteCredentialService implements DeleteCredential {
  constructor(
    private readonly credentials: CredentialRepository,
    private readonly cache: TokenCache,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: DeleteCredentialCommand): Promise<Result<{ success: true }>> {
    const id = CredentialId.of(cmd.id)
    const credential = await this.credentials.findById(id)
    if (credential && credential.createdBy === cmd.userId) {
      credential.markDeleted(this.clock.now())
      await this.credentials.delete(id)
      await this.events.publish(credential.pullEvents())
    }

    this.cache.invalidate(cmd.id)
    return ok({ success: true })
  }
}
