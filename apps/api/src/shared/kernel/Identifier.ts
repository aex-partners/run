// Base for typed identifiers. Wraps a string so a RecordId can never be passed
// where an EntityId is expected — the type system enforces it.
export abstract class Identifier<T extends string = string> {
  protected constructor(public readonly value: T) {}

  equals(other?: Identifier<T>): boolean {
    return !!other && other.constructor === this.constructor && other.value === this.value
  }

  toString(): string {
    return this.value
  }
}
