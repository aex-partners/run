import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import {
  CreateCredential,
  CreateCredentialCommand,
} from '@/contexts/credentials/application/ports/in/CreateCredential'
import { CredentialRepository } from '@/contexts/credentials/application/ports/out/CredentialRepository'
import { Credential } from '@/contexts/credentials/domain/Credential'

// Application service. The rules (non-empty name/plugin) live in the aggregate
// factory. Here we build it, persist (the repo encrypts the value), and publish
// events. Depends ONLY on ports.
export class CreateCredentialService implements CreateCredential {
  constructor(
    private readonly credentials: CredentialRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: CreateCredentialCommand): Promise<Result<{ id: string }>> {
    const id = this.credentials.nextId()
    const credential = Credential.create({
      id,
      name: cmd.name,
      pluginName: cmd.pluginName,
      type: cmd.type,
      value: cmd.value,
      createdBy: cmd.userId,
      now: this.clock.now(),
    })
    if (!credential.ok) return fail(credential.error)

    await this.credentials.save(credential.value)
    await this.events.publish(credential.value.pullEvents())
    return ok({ id: id.value })
  }
}
