import { Result } from '@/shared/kernel/Result'

// Driving port. Deletes a conversation (hard delete; FK cascade drops members and
// messages). The caller must be a member.
export interface DeleteConversationCommand {
  id: string
  actorId: string
}

export interface DeleteConversation {
  execute(cmd: DeleteConversationCommand): Promise<Result<{ success: true }>>
}
