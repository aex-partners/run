import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { RenameUser, RenameUserCommand } from '@/contexts/identity/application/ports/in/RenameUser'
import { UserRepository } from '@/contexts/identity/application/ports/out/UserRepository'
import { AuditTrail } from '@/contexts/identity/application/ports/out/AuditTrail'
import { UserId } from '@/contexts/identity/domain/UserId'

// users.updateName (admin renames another user).
export class RenameUserService implements RenameUser {
  constructor(
    private readonly users: UserRepository,
    private readonly audit: AuditTrail,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: RenameUserCommand): Promise<Result<{ success: true }>> {
    const target = await this.users.findById(UserId.of(cmd.userId))
    if (!target) return fail('User not found')

    const renamed = target.rename(cmd.name, this.clock.now())
    if (!renamed.ok) return fail(renamed.error)

    await this.users.save(target)
    await this.events.publish(target.pullEvents())

    const actor = await this.users.findById(UserId.of(cmd.actorId))
    await this.audit.record({
      actorId: cmd.actorId,
      actorEmail: actor?.email.value ?? null,
      action: 'user.renamed',
      resourceType: 'user',
      resourceId: cmd.userId,
      metadata: { name: cmd.name },
    })

    return ok({ success: true })
  }
}
