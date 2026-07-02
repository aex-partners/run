import { Result } from '@/shared/kernel/Result'

// Driving port behind emails.snooze. Hides the email and schedules its return.
export interface SnoozeEmailCommand {
  actorId: string
  id: string
  until: string
}

export interface SnoozeEmail {
  execute(cmd: SnoozeEmailCommand): Promise<Result<{ snoozedUntil: string }>>
}

// Driving port for the SnoozeWorker: a scheduled wake fired for one email.
export interface WakeSnoozedEmailCommand {
  emailId: string
}

export interface WakeSnoozedEmail {
  execute(cmd: WakeSnoozedEmailCommand): Promise<Result<{ awakened: boolean }>>
}
