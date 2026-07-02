import { Result } from '@/shared/kernel/Result'

// Admin invites a new user by name + email. actorId is the inviter (from the
// session) used for the DM bridge and the audit trail.
export interface InviteUserCommand {
  actorId: string
  name: string
  email: string
}

export interface InviteUser {
  execute(cmd: InviteUserCommand): Promise<Result<{ id: string; email: string; emailSent: boolean }>>
}
