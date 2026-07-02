import { Result, ok } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { RunDigest, DigestRunResult } from '@/contexts/notifications/application/ports/in/RunDigest'
import { NotificationRepository } from '@/contexts/notifications/application/ports/out/NotificationRepository'
import { NotificationPreferencesRepository } from '@/contexts/notifications/application/ports/out/NotificationPreferencesRepository'
import { UserDirectory } from '@/contexts/notifications/application/ports/out/UserDirectory'
import { EmailSender } from '@/contexts/notifications/application/ports/out/EmailSender'
import { NotificationPreferences } from '@/contexts/notifications/domain/NotificationPreferences'
import { UserId } from '@/contexts/notifications/domain/ids'

// Application orchestrator for the daily digest. The decision logic that matters
// (the unread window bound + idempotent advance) is PURE in NotificationPreferences;
// this service only sequences ports: take the users that have unread notifications
// (the only ones a run can notify), resolve their identities via the UserDirectory
// ACL, build each user's prefs aggregate, gather unread, send via the EmailSender
// ACL out-port, then advance the stamp.
//
// Differences from the AEX worker, by design: the upfront "no system mail account
// -> bail" check and locale resolution are email-context concerns now hidden behind
// EmailSender. Each user is isolated so one bad send never aborts the run; a failed
// send leaves that user's stamp unadvanced, so the next run retries them.
export class RunDigestService implements RunDigest {
  constructor(
    private readonly preferences: NotificationPreferencesRepository,
    private readonly notifications: NotificationRepository,
    private readonly users: UserDirectory,
    private readonly emailSender: EmailSender,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<Result<DigestRunResult>> {
    const now = this.clock.now()
    const recipientIds = await this.notifications.unreadRecipientIds()

    let sent = 0
    let skipped = 0

    if (recipientIds.length === 0) return ok({ sent, skipped })

    const users = await this.users.byIds(recipientIds.map((id) => id.value))
    const usersById = new Map(users.map((u) => [u.id, u]))

    for (const userId of recipientIds) {
      try {
        const user = usersById.get(userId.value)
        if (!user) {
          skipped++
          continue
        }

        const prefs = (await this.preferences.findByUserId(userId)) ?? NotificationPreferences.createDefault(userId, now)
        if (!prefs.isDigestEnabled()) {
          skipped++
          continue
        }

        const since = prefs.digestWindowStart(now)
        const items = await this.notifications.findUnreadForUserSince(userId, since)
        if (items.length === 0) {
          skipped++
          continue
        }

        const result = await this.emailSender.sendDigest({
          userId: user.id,
          name: user.name,
          count: items.length,
          items,
        })
        // Per-user failure isolation: leave the stamp unadvanced so the next run
        // retries this user, and do not count it either way.
        if (!result.ok) continue

        prefs.markDigestSent(now)
        await this.preferences.save(prefs)
        sent++
      } catch {
        // Swallow per-user faults (transient DB/SMTP) so later users still run.
      }
    }

    return ok({ sent, skipped })
  }
}
