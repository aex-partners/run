import { Result } from '@/shared/kernel/Result'

// Driving port. Hides messages for the caller only (adds them to each message's
// deletedFor list). Membership-guarded per message.
export interface DeleteMessagesForMeCommand {
  userId: string
  messageIds: string[]
}

export interface DeleteMessagesForMe {
  execute(cmd: DeleteMessagesForMeCommand): Promise<Result<{ success: true }>>
}
