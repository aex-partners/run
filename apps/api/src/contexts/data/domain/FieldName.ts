import { Result, ok, fail } from '@/shared/kernel/Result'

// VO. A field's identity within an entity. Snake/lower so it maps cleanly to a
// JSON key and a formula identifier.
export class FieldName {
  private constructor(public readonly value: string) {}

  static of(raw: string): Result<FieldName> {
    const v = raw.trim()
    if (!/^[a-z][a-z0-9_]*$/.test(v)) {
      return fail(`FieldName: "${raw}" must match /^[a-z][a-z0-9_]*$/`)
    }
    return ok(new FieldName(v))
  }

  equals(other: FieldName): boolean {
    return other.value === this.value
  }

  toString(): string {
    return this.value
  }
}
