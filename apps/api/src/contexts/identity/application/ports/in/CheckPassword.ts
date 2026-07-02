import { Result } from '@/shared/kernel/Result'

// Driving port invoked by the better-auth before-hook on every password-setting
// path (/sign-up/email, /reset-password, /change-password). Complexity always
// runs; the HIBP breach check runs on sign-up only (checkBreach=true). A failure
// carries the user-facing message. Mirrors auth/index.ts hooks.
export interface CheckPasswordCommand {
  password: string
  checkBreach: boolean
}

export interface CheckPassword {
  execute(cmd: CheckPasswordCommand): Promise<Result<void>>
}
