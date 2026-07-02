import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { ChangeUserRole, ChangeUserRoleCommand } from '@/contexts/identity/application/ports/in/ChangeUserRole'
import { UserRepository } from '@/contexts/identity/application/ports/out/UserRepository'
import { AuditTrail } from '@/contexts/identity/application/ports/out/AuditTrail'
import { UserId } from '@/contexts/identity/domain/UserId'
import { UserRole } from '@/contexts/identity/domain/UserRole'

// users.updateRole. Self-change is rejected here (needs the actor id); the
// owner-specific transition rules are enforced inside User.changeRole.
export class ChangeUserRoleService implements ChangeUserRole {
  constructor(
    private readonly users: UserRepository,
    private readonly audit: AuditTrail,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: ChangeUserRoleCommand): Promise<Result<{ success: true }>> {
    if (cmd.userId === cmd.actorId) return fail('Cannot change your own role')

    const newRole = UserRole.of(cmd.role)
    if (!newRole.ok) return fail(newRole.error)
    const actorRole = UserRole.fromTrusted(cmd.actorRole)

    const target = await this.users.findById(UserId.of(cmd.userId))
    if (!target) return fail('User not found')

    const from = target.role.value
    const changed = target.changeRole(newRole.value, actorRole, this.clock.now())
    if (!changed.ok) return fail(changed.error)

    await this.users.save(target)
    await this.events.publish(target.pullEvents())

    const actor = await this.users.findById(UserId.of(cmd.actorId))
    await this.audit.record({
      actorId: cmd.actorId,
      actorEmail: actor?.email.value ?? null,
      action: 'user.role_changed',
      resourceType: 'user',
      resourceId: cmd.userId,
      metadata: { from, to: cmd.role },
    })

    return ok({ success: true })
  }
}
