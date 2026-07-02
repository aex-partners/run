import { Result } from '@/shared/kernel/Result'

// Clear accumulated lockout state for an email. Called by the sign-in after-hook
// on a successful authentication. Mirrors resetLoginAttempts.
export interface ResetLoginAttemptsCommand {
  email: string
}

export interface ResetLoginAttempts {
  execute(cmd: ResetLoginAttemptsCommand): Promise<Result<void>>
}
