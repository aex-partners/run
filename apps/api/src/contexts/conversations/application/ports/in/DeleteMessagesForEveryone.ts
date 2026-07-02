import { Result } from '@/shared/kernel/Result'

// Driving port. Soft-deletes messages for everyone. Author-only per message
// (a non-author attempt fails). Missing messages are skipped.
export interface DeleteMessagesForEveryoneCommand {
  userId: string
  messageIds: string[]
}

export interface DeleteMessagesForEveryone {
  execute(cmd: DeleteMessagesForEveryoneCommand): Promise<Result<{ success: true }>>
}
