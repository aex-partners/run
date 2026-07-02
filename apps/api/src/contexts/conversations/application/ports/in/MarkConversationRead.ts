import { Result } from '@/shared/kernel/Result'

// Driving port. Advances the caller's read cursor (lastReadAt) for a conversation.
export interface MarkConversationReadCommand {
  id: string
  userId: string
}

export interface MarkConversationRead {
  execute(cmd: MarkConversationReadCommand): Promise<Result<{ success: true }>>
}
