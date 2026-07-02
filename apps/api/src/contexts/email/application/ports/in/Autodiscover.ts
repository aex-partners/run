import { Result } from '@/shared/kernel/Result'
import { DiscoveredMailSettings } from '@/contexts/email/application/ports/out/EmailAutodiscovery'

// Driving port behind emails.mailAccounts.autodiscover. Rate-limited per email
// address (AEX's 60s cooldown), then delegated to the EmailAutodiscovery probe.
export interface AutodiscoverCommand {
  email: string
}

export interface Autodiscover {
  execute(cmd: AutodiscoverCommand): Promise<Result<DiscoveredMailSettings | null>>
}
