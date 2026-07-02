import { ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { GeneratePublicLink, GeneratePublicLinkCommand } from '@/contexts/files/application/ports/in/GeneratePublicLink'
import { FileRepository } from '@/contexts/files/application/ports/out/FileRepository'
import { FileId } from '@/contexts/files/domain/ids'

// Enabling mints an unguessable token via the repository's token factory;
// disabling clears it. Token generation is an adapter concern (the use case
// stays free of crypto/npm).
export class GeneratePublicLinkService implements GeneratePublicLink {
  constructor(
    private readonly files: FileRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: GeneratePublicLinkCommand) {
    const file = await this.files.findById(FileId.of(cmd.id))
    if (!file) return fail('GeneratePublicLink: file not found')

    const token = cmd.enabled ? this.files.nextPublicToken() : null
    file.setPublicToken(token, this.clock.now())
    await this.files.save(file)
    await this.events.publish(file.pullEvents())
    return ok({ publicToken: token })
  }
}
