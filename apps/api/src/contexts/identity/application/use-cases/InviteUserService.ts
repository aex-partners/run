import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { InviteUser, InviteUserCommand } from '@/contexts/identity/application/ports/in/InviteUser'
import { UserRepository } from '@/contexts/identity/application/ports/out/UserRepository'
import { VerificationStore } from '@/contexts/identity/application/ports/out/VerificationStore'
import { ConversationGateway } from '@/contexts/identity/application/ports/out/ConversationGateway'
import { InviteNotifier } from '@/contexts/identity/application/ports/out/InviteNotifier'
import { AuditTrail } from '@/contexts/identity/application/ports/out/AuditTrail'
import { Email } from '@/contexts/identity/domain/Email'
import { UserId } from '@/contexts/identity/domain/UserId'
import { User } from '@/contexts/identity/domain/User'

// 7-day window for an invited user to set their initial password: much longer
// than the 1h forgot-password window because an invite is a one-shot onboarding
// link, not a re-auth flow.
const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

// users.invite. Creates an already-verified, password-less account, mints a
// reset-password token, seeds the chat space (DM + Eric) via the assistant ACL,
// emails the set-password link via the notifier ACL, and records the audit row.
export class InviteUserService implements InviteUser {
  constructor(
    private readonly users: UserRepository,
    private readonly verifications: VerificationStore,
    private readonly conversations: ConversationGateway,
    private readonly notifier: InviteNotifier,
    private readonly audit: AuditTrail,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: InviteUserCommand): Promise<Result<{ id: string; email: string; emailSent: boolean }>> {
    const email = Email.of(cmd.email)
    if (!email.ok) return fail(email.error)

    if (await this.users.existsByEmail(email.value)) {
      return fail('A user with that email already exists')
    }

    const actor = await this.users.findById(UserId.of(cmd.actorId))

    const now = this.clock.now()
    const id = this.users.nextId()
    const user = User.invite(id, cmd.name, email.value, now)
    if (!user.ok) return fail(user.error)

    await this.users.save(user.value)
    await this.events.publish(user.value.pullEvents())

    const { token } = await this.verifications.issueResetToken({
      userId: id.value,
      expiresAt: new Date(now.getTime() + INVITE_TOKEN_TTL_MS),
    })

    // Find-or-create the inviter<->invitee DM and the invitee's Eric conversation.
    await this.conversations.ensureDm(cmd.actorId, id.value)
    await this.conversations.ensureEric(id.value)

    const result = await this.notifier.sendInvite({
      to: email.value.value,
      name: cmd.name,
      inviterName: actor?.name ?? '',
      token,
    })

    await this.audit.record({
      actorId: cmd.actorId,
      actorEmail: actor?.email.value ?? null,
      action: 'user.invited',
      resourceType: 'user',
      resourceId: id.value,
      metadata: { email: email.value.value, name: cmd.name },
    })

    return ok({ id: id.value, email: email.value.value, emailSent: result.sent })
  }
}
