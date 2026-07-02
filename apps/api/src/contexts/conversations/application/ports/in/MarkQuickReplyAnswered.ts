import { Result } from '@/shared/kernel/Result'

// Driving port. Flags a message's quick-reply block as answered. A no-op (still
// success) when the message or block is absent — mirrors the source's lenient
// behavior.
export interface MarkQuickReplyAnsweredCommand {
  messageId: string
}

export interface MarkQuickReplyAnswered {
  execute(cmd: MarkQuickReplyAnsweredCommand): Promise<Result<{ success: true }>>
}
