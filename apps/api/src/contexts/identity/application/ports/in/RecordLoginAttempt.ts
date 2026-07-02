import { Result } from '@/shared/kernel/Result'

// Optimistically register a failed-or-pending sign-in attempt. Run on every
// attempt before password verification; a later success clears it via
// ResetLoginAttempts. Mirrors registerLoginAttempt.
export interface RecordLoginAttemptCommand {
  email: string
}

export interface RecordLoginAttempt {
  execute(cmd: RecordLoginAttemptCommand): Promise<Result<void>>
}
