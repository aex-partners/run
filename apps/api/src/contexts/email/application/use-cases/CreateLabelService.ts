import { ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { CreateLabel, CreateLabelCommand } from '@/contexts/email/application/ports/in/ManageLabels'
import { EmailAccountRepository } from '@/contexts/email/application/ports/out/EmailAccountRepository'
import { EmailLabelRepository } from '@/contexts/email/application/ports/out/EmailLabelRepository'
import { EmailLabel } from '@/contexts/email/domain/EmailLabel'

// Creates a label definition for one of the caller's accounts.
export class CreateLabelService implements CreateLabel {
  constructor(
    private readonly accounts: EmailAccountRepository,
    private readonly labels: EmailLabelRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: CreateLabelCommand) {
    const accountIds = await this.accounts.accountIdsForUser(cmd.actorId)
    if (!accountIds.includes(cmd.accountId)) return fail('Account not found')

    const id = this.labels.nextId()
    const label = EmailLabel.create(id, cmd.accountId, cmd.name, cmd.color, this.clock.now())
    if (!label.ok) return fail(label.error)

    await this.labels.save(label.value)
    await this.events.publish(label.value.pullEvents())
    return ok({ id: id.value, accountId: cmd.accountId, name: label.value.name, color: label.value.color })
  }
}
