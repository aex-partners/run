import { ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { ToggleLabel, ToggleLabelCommand } from '@/contexts/email/application/ports/in/ToggleLabel'
import { EmailAccountRepository } from '@/contexts/email/application/ports/out/EmailAccountRepository'
import { EmailRepository } from '@/contexts/email/application/ports/out/EmailRepository'
import { EmailLabelRepository } from '@/contexts/email/application/ports/out/EmailLabelRepository'
import { EmailId } from '@/contexts/email/domain/ids'
import { DEFAULT_LABEL_COLOR } from '@/contexts/email/domain/Label'

// Toggles a named label tag on one accessible email, copying the colour from the
// account's label definition (default grey when undefined).
export class ToggleLabelService implements ToggleLabel {
  constructor(
    private readonly accounts: EmailAccountRepository,
    private readonly emails: EmailRepository,
    private readonly labels: EmailLabelRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: ToggleLabelCommand) {
    const accountIds = await this.accounts.accountIdsForUser(cmd.actorId)
    const email = await this.emails.findInAccounts(EmailId.of(cmd.id), accountIds)
    if (!email) return fail('Email not found')

    const labelDef = await this.labels.findByNameInAccounts(cmd.labelName, accountIds)
    const color = labelDef?.color ?? DEFAULT_LABEL_COLOR

    email.toggleLabel(cmd.labelName, color, this.clock.now())
    await this.emails.save(email)
    await this.events.publish(email.pullEvents())
    return ok({ labels: email.labels })
  }
}
