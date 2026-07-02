import { Result } from '@/shared/kernel/Result'

// Driving port, called by the ReminderWorker when the delayed job fires.
// Idempotent: re-running for an already fired/cancelled/missing reminder is a
// no-op (`fired: false`), so BullMQ retries are safe.
export interface FireReminderCommand {
  reminderId: string
}

export interface FireReminder {
  execute(cmd: FireReminderCommand): Promise<Result<{ fired: boolean }>>
}
