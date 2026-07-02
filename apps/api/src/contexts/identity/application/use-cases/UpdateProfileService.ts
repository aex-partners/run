import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { UpdateProfile, UpdateProfileCommand } from '@/contexts/identity/application/ports/in/UpdateProfile'
import { UserRepository } from '@/contexts/identity/application/ports/out/UserRepository'
import { UserId } from '@/contexts/identity/domain/UserId'

// profile.updateName. Self-scoped via cmd.userId (the session id); no audit row
// in the source for self-service edits.
export class UpdateProfileService implements UpdateProfile {
  constructor(
    private readonly users: UserRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: UpdateProfileCommand): Promise<Result<{ success: true }>> {
    const user = await this.users.findById(UserId.of(cmd.userId))
    if (!user) return fail('User not found')

    const renamed = user.rename(cmd.name, this.clock.now())
    if (!renamed.ok) return fail(renamed.error)

    await this.users.save(user)
    await this.events.publish(user.pullEvents())
    return ok({ success: true })
  }
}
