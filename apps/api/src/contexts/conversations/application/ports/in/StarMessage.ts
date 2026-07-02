import { Result } from '@/shared/kernel/Result'

// Driving port. Toggles a message's starred flag (personal, but membership-guarded
// so the WS update stays scoped to members).
export interface StarMessageCommand {
  messageId: string
  userId: string
}

export interface StarMessage {
  execute(cmd: StarMessageCommand): Promise<Result<{ success: true; starred: boolean }>>
}
