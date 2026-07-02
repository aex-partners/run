import { Identifier } from '@/shared/kernel/Identifier'

// The lockout aggregate is keyed by the (normalized) email, not a surrogate id.
// Build it through Email.of so the key always matches the persisted row.
export class LoginAttemptId extends Identifier {
  static of(value: string): LoginAttemptId {
    return new LoginAttemptId(value)
  }
}
