import { Result } from '@/shared/kernel/Result'

// Driving port. Toggles a message's pinned flag. Caller must be a member of the
// message's conversation.
export interface PinMessageCommand {
  messageId: string
  userId: string
}

export interface PinMessage {
  execute(cmd: PinMessageCommand): Promise<Result<{ success: true; pinned: boolean }>>
}
