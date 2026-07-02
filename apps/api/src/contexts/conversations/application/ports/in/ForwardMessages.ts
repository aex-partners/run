import { Result } from '@/shared/kernel/Result'

// Driving port. Forwards messages into other conversations. The caller must be a
// member of BOTH the source conversation of each message (anti-IDOR) and every
// recipient conversation. Forwarded copies carry a `forwardedFrom` metadata tag.
export interface ForwardMessagesCommand {
  actorId: string
  messageIds: string[]
  recipientConversationIds: string[]
}

export interface ForwardMessages {
  execute(cmd: ForwardMessagesCommand): Promise<Result<{ success: true }>>
}
