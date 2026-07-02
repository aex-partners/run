import { Result, ok } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import {
  UpdatePreferences,
  UpdatePreferencesCommand,
} from '@/contexts/notifications/application/ports/in/UpdatePreferences'
import { NotificationPreferencesRepository } from '@/contexts/notifications/application/ports/out/NotificationPreferencesRepository'
import { NotificationPreferences } from '@/contexts/notifications/domain/NotificationPreferences'
import { UserId } from '@/contexts/notifications/domain/ids'

// Upserts the self-scoped digest preference. A missing row is materialised as the
// domain default (enabled) before the toggle is applied, so save() always writes
// a complete aggregate.
export class UpdatePreferencesService implements UpdatePreferences {
  constructor(
    private readonly preferences: NotificationPreferencesRepository,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: UpdatePreferencesCommand): Promise<Result<{ emailDigest: boolean }>> {
    const userId = UserId.of(cmd.userId)
    const now = this.clock.now()
    const existing = await this.preferences.findByUserId(userId)
    const prefs = existing ?? NotificationPreferences.createDefault(userId, now)
    prefs.setEmailDigest(cmd.emailDigest, now)
    await this.preferences.save(prefs)
    return ok({ emailDigest: cmd.emailDigest })
  }
}
