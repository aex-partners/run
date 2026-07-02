import { ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { Autodiscover, AutodiscoverCommand } from '@/contexts/email/application/ports/in/Autodiscover'
import { EmailAutodiscovery } from '@/contexts/email/application/ports/out/EmailAutodiscovery'

const COOLDOWN_MS = 60_000

// Rate-limits per email address (AEX's in-memory 60s cooldown), then delegates
// to the network probe. The cooldown map lives on this singleton service —
// in-memory state, no npm — exactly as the router held it.
export class AutodiscoverService implements Autodiscover {
  private readonly cooldown = new Map<string, number>()

  constructor(
    private readonly autodiscovery: EmailAutodiscovery,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: AutodiscoverCommand) {
    const key = cmd.email.toLowerCase()
    const now = this.clock.now().getTime()
    const last = this.cooldown.get(key)
    if (last !== undefined && now - last < COOLDOWN_MS) {
      return fail('Rate limit: please wait before retrying autodiscover.')
    }
    this.cooldown.set(key, now)

    const settings = await this.autodiscovery.discover(cmd.email)
    return ok(settings)
  }
}
