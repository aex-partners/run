import { Result, ok, fail } from '@/shared/kernel/Result'

// VO over the free-text `role` column. The known roles are user < admin < owner;
// authorization guards only care about the admin/owner predicates. Kept as a VO
// (not an enum) because the column is an open string in the source schema.
export class UserRole {
  private constructor(public readonly value: string) {}

  static of(raw: string): Result<UserRole> {
    const v = raw.trim()
    if (v.length < 1) return fail('UserRole: role is required')
    return ok(new UserRole(v))
  }

  // Unchecked variant for rehydration from a trusted persisted row.
  static fromTrusted(value: string): UserRole {
    return new UserRole(value)
  }

  isOwner(): boolean {
    return this.value === 'owner'
  }

  isAdminOrOwner(): boolean {
    return this.value === 'admin' || this.value === 'owner'
  }

  equals(other: UserRole): boolean {
    return other.value === this.value
  }

  toString(): string {
    return this.value
  }
}
