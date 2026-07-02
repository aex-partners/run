// VO. URL/identifier-safe slug derived from a display name. Ports AEX's
// `slugify` exactly (NFD-normalize, strip accents, non-alphanumerics -> "_",
// trim leading/trailing "_"). Pure: no crypto fallback here (the empty-slug
// fallback is an adapter concern, since it needs randomness).
export class Slug {
  private constructor(public readonly value: string) {}

  static from(name: string): Slug {
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
    return new Slug(slug)
  }

  static of(value: string): Slug {
    return new Slug(value)
  }

  isEmpty(): boolean {
    return this.value.length === 0
  }

  toString(): string {
    return this.value
  }
}
