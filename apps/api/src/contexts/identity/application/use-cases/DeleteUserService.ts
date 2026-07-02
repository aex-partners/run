import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DeleteUser, DeleteUserCommand } from '@/contexts/identity/application/ports/in/DeleteUser'
import { UserRepository } from '@/contexts/identity/application/ports/out/UserRepository'
import { AuditTrail } from '@/contexts/identity/application/ports/out/AuditTrail'
import { UserId } from '@/contexts/identity/domain/UserId'

// users.delete. Self-delete is rejected.
export class DeleteUserService implements DeleteUser {
  constructor(
    private readonly users: UserRepository,
    private readonly audit: AuditTrail,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: DeleteUserCommand): Promise<Result<{ success: true }>> {
    if (cmd.userId === cmd.actorId) return fail('Cannot delete yourself')

    const target = await this.users.findById(UserId.of(cmd.userId))
    if (!target) return fail('User not found')

    target.markDeleted(this.clock.now())
    await this.users.delete(target.id)
    await this.events.publish(target.pullEvents())

    const actor = await this.users.findById(UserId.of(cmd.actorId))
    await this.audit.record({
      actorId: cmd.actorId,
      actorEmail: actor?.email.value ?? null,
      action: 'user.deleted',
      resourceType: 'user',
      resourceId: cmd.userId,
    })

    return ok({ success: true })
  }
}
