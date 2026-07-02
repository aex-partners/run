// VO. Optimistic-concurrency token. Every write does compare-and-set against the
// expected version to prevent lost updates from concurrent manual/AI edits.
export class Version {
  private constructor(public readonly value: number) {}

  static initial(): Version {
    return new Version(0)
  }

  static of(value: number): Version {
    return new Version(value)
  }

  next(): Version {
    return new Version(this.value + 1)
  }

  equals(other: Version): boolean {
    return other.value === this.value
  }
}
