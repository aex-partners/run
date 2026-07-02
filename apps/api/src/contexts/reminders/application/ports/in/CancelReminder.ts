import { Result } from '@/shared/kernel/Result'

// Driving port. `userId` scopes the cancel to the owner (a non-owner sees a
// "not found" failure, matching the source router's WHERE created_by = me).
export interface CancelReminderCommand {
  reminderId: string
  userId: string
}

export interface CancelReminder {
  execute(cmd: CancelReminderCommand): Promise<Result<{ success: true }>>
}
