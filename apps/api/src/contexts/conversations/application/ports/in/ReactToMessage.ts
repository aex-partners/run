import { Result } from '@/shared/kernel/Result'
import { Reaction } from '@/contexts/conversations/domain/Reaction'

// Driving port. Toggles an emoji reaction by the caller on a message. Caller must
// be a member of the message's conversation.
export interface ReactToMessageCommand {
  messageId: string
  userId: string
  emoji: string
}

export interface ReactToMessage {
  execute(cmd: ReactToMessageCommand): Promise<Result<{ success: true; reactions: Reaction[] }>>
}
