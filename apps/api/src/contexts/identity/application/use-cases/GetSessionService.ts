import { Result, ok } from '@/shared/kernel/Result'
import { GetSession, GetSessionQuery, SessionUserView } from '@/contexts/identity/application/ports/in/GetSession'
import { UserRepository } from '@/contexts/identity/application/ports/out/UserRepository'
import { UserId } from '@/contexts/identity/domain/UserId'

// auth.me. Resolves the current user from the session-supplied id. Returns null
// when there is no session or the user no longer exists.
export class GetSessionService implements GetSession {
  constructor(private readonly users: UserRepository) {}

  async execute(q: GetSessionQuery): Promise<Result<SessionUserView | null>> {
    if (!q.userId) return ok(null)
    const user = await this.users.findById(UserId.of(q.userId))
    if (!user) return ok(null)
    return ok({
      id: user.id.value,
      name: user.name,
      email: user.email.value,
      role: user.role.value,
      kind: user.kind,
      image: user.image,
      emailVerified: user.emailVerified,
      banned: user.banned,
    })
  }
}
