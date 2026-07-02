import { Result } from '@/shared/kernel/Result'

// Admin manual unlock (D4): clears account-lockout state for an email. Mirrors
// users.unlockAccount.
export interface UnlockAccountCommand {
  actorId: string
  email: string
}

export interface UnlockAccount {
  execute(cmd: UnlockAccountCommand): Promise<Result<{ success: true }>>
}
