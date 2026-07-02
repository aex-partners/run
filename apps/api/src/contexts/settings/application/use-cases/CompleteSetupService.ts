import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import {
  CompleteSetup,
  CompleteSetupCommand,
} from '@/contexts/settings/application/ports/in/CompleteSetup'
import { SettingsRepository } from '@/contexts/settings/application/ports/out/SettingsRepository'
import { SetupProvisioner } from '@/contexts/settings/application/ports/out/SetupProvisioner'
import {
  serializeValue,
  SETUP_COMPLETE_KEY,
  SETUP_COMPLETE_VALUE,
} from '@/contexts/settings/domain/Setting'
import { setupSettingEntries } from '@/contexts/settings/domain/SetupPlan'

// One-time setup. Writes the settings-owned rows, marks setup complete, then
// hands the cross-context provisioning to the SetupProvisioner ACL out-port.
export class CompleteSetupService implements CompleteSetup {
  constructor(
    private readonly settings: SettingsRepository,
    private readonly provisioner: SetupProvisioner,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: CompleteSetupCommand): Promise<Result<{ success: true }>> {
    // Setup runs exactly once. Once complete, block re-runs so a logged-in
    // non-owner cannot re-call this to self-promote to owner (privilege escalation).
    const existing = await this.settings.find(SETUP_COMPLETE_KEY)
    if (existing === SETUP_COMPLETE_VALUE) {
      return fail('Setup already completed')
    }

    const now = this.clock.now()
    for (const entry of setupSettingEntries(cmd)) {
      await this.settings.upsert(entry.key, serializeValue(entry.value), now)
    }
    await this.settings.upsert(SETUP_COMPLETE_KEY, SETUP_COMPLETE_VALUE, now)

    // Entities, Eric agent/conversation/kickoff, owner promotion, invites and the
    // SMTP mail account are provisioned behind the ACL out-port — settings imports
    // no other context.
    await this.provisioner.provision(cmd)

    return ok({ success: true })
  }
}
