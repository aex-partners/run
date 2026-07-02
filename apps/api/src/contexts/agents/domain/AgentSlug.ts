// VO. A URL-safe, unique-by-business-rule handle for an agent. Generation mirrors
// AEX's slugify: lowercase, strip diacritics, collapse non-alphanumerics into
// "_", trim leading/trailing "_". An empty result (e.g. an emoji-only name) falls
// back to "agent"; cross-collection UNIQUENESS is a boundary concern enforced by
// the repository (existsBySlug) + the DB unique index, not by this value object.
export class AgentSlug {
  private constructor(public readonly value: string) {}

  static fromName(name: string): AgentSlug {
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
    return new AgentSlug(slug || 'agent')
  }

  static of(value: string): AgentSlug {
    return new AgentSlug(value)
  }

  equals(other: AgentSlug): boolean {
    return other.value === this.value
  }

  toString(): string {
    return this.value
  }
}
