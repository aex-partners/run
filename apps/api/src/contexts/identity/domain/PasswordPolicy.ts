import { Result, ok, fail } from '@/shared/kernel/Result'

// PURE password complexity rules. Length plus all four character classes. This is
// the static CODE side of the policy; the dynamic "has this password leaked"
// check is an out-port (BreachChecker / HIBP) because it needs the network.
// Ported 1:1 from auth/password-policy.ts.
export const MIN_PASSWORD_LENGTH = 12
export const MAX_PASSWORD_LENGTH = 128

export const PasswordPolicy = {
  // Returns ok(undefined) when the password passes, or fail(message) describing
  // the first violated rule.
  validateComplexity(password: string): Result<void> {
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return fail(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`)
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
      return fail(`Password must be at most ${MAX_PASSWORD_LENGTH} characters long.`)
    }
    if (!/[a-z]/.test(password)) return fail('Password must contain a lowercase letter.')
    if (!/[A-Z]/.test(password)) return fail('Password must contain an uppercase letter.')
    if (!/[0-9]/.test(password)) return fail('Password must contain a digit.')
    if (!/[^a-zA-Z0-9]/.test(password)) return fail('Password must contain a special character.')
    return ok(undefined)
  },
}
