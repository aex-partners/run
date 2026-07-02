import { Result, ok, fail } from '@/shared/kernel/Result'

// VO. The user's natural identifier. Always normalized (trimmed + lowercased) so
// equality, uniqueness and the lockout key are stable regardless of how the
// address was typed. Mirrors the source's `email.toLowerCase()` and the
// lockout `normalizeEmail`.
export class Email {
  private constructor(public readonly value: string) {}

  static of(raw: string): Result<Email> {
    const v = raw.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      return fail(`Email: "${raw}" is not a valid email address`)
    }
    return ok(new Email(v))
  }

  // Unchecked variant for rehydrating a trusted persisted row. Normalizes but
  // never rejects, so a legacy/odd address still loads instead of crashing.
  static fromTrusted(value: string): Email {
    return new Email(value.trim().toLowerCase())
  }

  equals(other: Email): boolean {
    return other.value === this.value
  }

  toString(): string {
    return this.value
  }
}
