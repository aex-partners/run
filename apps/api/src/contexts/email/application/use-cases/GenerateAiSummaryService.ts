import { ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { GenerateAiSummary, GenerateAiSummaryCommand } from '@/contexts/email/application/ports/in/GenerateAiContent'
import { EmailAccountRepository } from '@/contexts/email/application/ports/out/EmailAccountRepository'
import { EmailRepository } from '@/contexts/email/application/ports/out/EmailRepository'
import { AiDrafter } from '@/contexts/email/application/ports/out/AiDrafter'
import { EmailId } from '@/contexts/email/domain/ids'

// Generates and stores a one-to-two sentence summary for an accessible email.
// Gated on the AI feature flag; the LLM call is delegated to the AiDrafter ACL.
export class GenerateAiSummaryService implements GenerateAiSummary {
  constructor(
    private readonly accounts: EmailAccountRepository,
    private readonly emails: EmailRepository,
    private readonly ai: AiDrafter,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: GenerateAiSummaryCommand) {
    if (!(await this.ai.isEnabled())) return fail('AI for emails is disabled.')

    const accountIds = await this.accounts.accountIdsForUser(cmd.actorId)
    const email = await this.emails.findInAccounts(EmailId.of(cmd.id), accountIds)
    if (!email) return fail('Email not found')

    const summary = await this.ai.summarize(email.bodyForAi())
    email.setAiSummary(summary, this.clock.now())
    await this.emails.save(email)
    await this.events.publish(email.pullEvents())
    return ok({ summary })
  }
}
