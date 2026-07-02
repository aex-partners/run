// PURE slug derivation, ported from the source db/entity-fields.ts `slugify`
// (lowercase, strip diacritics, collapse non-alphanumerics to "_"). The source's
// random fallback for empty results is replaced with a deterministic one so the
// domain stays pure (no crypto / randomness).
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  return slug || 'skill'
}

// The slug-uniqueness invariant. Derivation is pure (above); the actual lookup is
// an IO/set-level concern fulfilled by the SkillRepository out-port, after which
// the use case raises THIS domain error. The DB `slug unique` column is the
// backstop (source contract).
export const slugTakenError = (slug: string): string => `Skill: slug "${slug}" is already in use`
