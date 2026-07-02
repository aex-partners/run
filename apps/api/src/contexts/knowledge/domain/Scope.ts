import { Result, ok, fail } from '@/shared/kernel/Result'

// VO. Who a knowledge entry is visible to. PURE rule: `company` is shared with
// everyone; `personal` is private to its creator. The aggregate combines this
// with `createdBy` to answer visibility/authority questions.
export type ScopeKind = 'company' | 'personal'

export class Scope {
  private constructor(public readonly kind: ScopeKind) {}

  static company(): Scope {
    return new Scope('company')
  }

  static personal(): Scope {
    return new Scope('personal')
  }

  static of(raw: string): Result<Scope> {
    if (raw === 'company' || raw === 'personal') return ok(new Scope(raw))
    return fail(`Scope: must be "company" or "personal", got "${raw}"`)
  }

  isShared(): boolean {
    return this.kind === 'company'
  }

  isPersonal(): boolean {
    return this.kind === 'personal'
  }

  equals(other: Scope): boolean {
    return other.kind === this.kind
  }
}
