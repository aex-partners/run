import { Result, ok } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { SetSetting, SetSettingCommand } from '@/contexts/settings/application/ports/in/SetSetting'
import { SettingsRepository } from '@/contexts/settings/application/ports/out/SettingsRepository'
import { AuditTrail } from '@/contexts/settings/application/ports/out/AuditTrail'
import { serializeValue } from '@/contexts/settings/domain/Setting'

// Transaction-script use case: upsert the value, then record the audit event via
// the ACL out-port (key only, never the value — settings can hold secrets).
export class SetSettingService implements SetSetting {
  constructor(
    private readonly settings: SettingsRepository,
    private readonly audit: AuditTrail,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: SetSettingCommand): Promise<Result<{ success: true }>> {
    await this.settings.upsert(cmd.key, serializeValue(cmd.value), this.clock.now())
    await this.audit.record({
      actorId: cmd.actorId,
      actorEmail: cmd.actorEmail ?? null,
      action: 'settings.changed',
      resourceType: 'settings',
      resourceId: cmd.key,
    })
    return ok({ success: true })
  }
}
