import { Result } from '@/shared/kernel/Result'

// Driving port. Adds a user to a conversation. The caller must already be a member.
export interface AddMemberCommand {
  conversationId: string
  actorId: string
  userId: string
}

export interface AddMember {
  execute(cmd: AddMemberCommand): Promise<Result<{ success: true }>>
}
