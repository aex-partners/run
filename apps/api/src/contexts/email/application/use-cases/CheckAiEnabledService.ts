import { ok } from '@/shared/kernel/Result'
import { CheckAiEnabled } from '@/contexts/email/application/ports/in/GenerateAiContent'
import { AiDrafter } from '@/contexts/email/application/ports/out/AiDrafter'

// Backs emails.aiEnabled: reports whether AI email features are on, via the
// AiDrafter ACL.
export class CheckAiEnabledService implements CheckAiEnabled {
  constructor(private readonly ai: AiDrafter) {}

  async execute() {
    return ok({ enabled: await this.ai.isEnabled() })
  }
}
