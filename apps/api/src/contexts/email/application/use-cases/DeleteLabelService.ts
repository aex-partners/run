import { ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DeleteLabel, DeleteLabelCommand } from '@/contexts/email/application/ports/in/ManageLabels'
import { EmailAccountRepository } from '@/contexts/email/application/ports/out/EmailAccountRepository'
import { EmailLabelRepository } from '@/contexts/email/application/ports/out/EmailLabelRepository'
import { EmailLabelId } from '@/contexts/email/domain/ids'

// Deletes a label definition, but only if it belongs to one of the caller's
// accounts (AEX verifies the label's account after loading it).
export class DeleteLabelService implements DeleteLabel {
  constructor(
    private readonly accounts: EmailAccountRepository,
    private readonly labels: EmailLabelRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: DeleteLabelCommand) {
    const label = await this.labels.findById(EmailLabelId.of(cmd.id))
    if (!label) return fail('Label not found')

    const accountIds = await this.accounts.accountIdsForUser(cmd.actorId)
    if (!accountIds.includes(label.accountId)) return fail('Not authorized')

    label.markDeleted(this.clock.now())
    await this.labels.delete(label)
    await this.events.publish(label.pullEvents())
    return ok({ success: true as const })
  }
}
