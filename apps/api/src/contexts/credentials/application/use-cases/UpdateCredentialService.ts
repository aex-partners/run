import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import {
  UpdateCredential,
  UpdateCredentialCommand,
} from '@/contexts/credentials/application/ports/in/UpdateCredential'
import { CredentialRepository } from '@/contexts/credentials/application/ports/out/CredentialRepository'
import { TokenCache } from '@/contexts/credentials/application/ports/out/TokenCache'
import { CredentialId } from '@/contexts/credentials/domain/ids'

// Application service. Loads the owner-scoped credential, applies the patch, and
// persists. The cached (decrypted/OAuth) value is ALWAYS dropped so the next
// resolution re-reads — mirrors the source `invalidateCredentialCache`. A missing
// or non-owned id is a silent no-op (the source's WHERE clause simply matches no
// row).
export class UpdateCredentialService implements UpdateCredential {
  constructor(
    private readonly credentials: CredentialRepository,
    private readonly cache: TokenCache,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: UpdateCredentialCommand): Promise<Result<{ success: true }>> {
    const credential = await this.credentials.findById(CredentialId.of(cmd.id))
    if (credential && credential.createdBy === cmd.userId) {
      const changed = credential.update({
        name: cmd.name,
        value: cmd.value,
        status: cmd.status,
        now: this.clock.now(),
      })
      if (!changed.ok) return fail(changed.error)
      await this.credentials.save(credential)
      await this.events.publish(credential.pullEvents())
    }

    this.cache.invalidate(cmd.id)
    return ok({ success: true })
  }
}
