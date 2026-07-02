import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { SetUserStatus, SetUserStatusCommand } from '@/contexts/identity/application/ports/in/SetUserStatus'
import { UserRepository } from '@/contexts/identity/application/ports/out/UserRepository'
import { AuditTrail } from '@/contexts/identity/application/ports/out/AuditTrail'
import { UserId } from '@/contexts/identity/domain/UserId'

// users.updateStatus. Toggling your own status is rejected (you cannot ban
// yourself).
export class SetUserStatusService implements SetUserStatus {
  constructor(
    private readonly users: UserRepository,
    private readonly audit: AuditTrail,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: SetUserStatusCommand): Promise<Result<{ success: true }>> {
    if (cmd.userId === cmd.actorId) return fail('Cannot change your own status')

    const target = await this.users.findById(UserId.of(cmd.userId))
    if (!target) return fail('User not found')

    const changed = target.setStatus(cmd.status, this.clock.now())
    if (!changed.ok) return fail(changed.error)

    await this.users.save(target)
    await this.events.publish(target.pullEvents())

    const actor = await this.users.findById(UserId.of(cmd.actorId))
    await this.audit.record({
      actorId: cmd.actorId,
      actorEmail: actor?.email.value ?? null,
      action: 'user.status_changed',
      resourceType: 'user',
      resourceId: cmd.userId,
      metadata: { status: cmd.status },
    })

    return ok({ success: true })
  }
}
