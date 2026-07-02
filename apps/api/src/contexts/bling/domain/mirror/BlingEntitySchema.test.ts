import { describe, it, expect } from 'vitest'
import { BLING_ENTITIES, BlingEntitySlug } from '@/contexts/bling/domain/mirror/BlingEntitySchema'
import { Slug } from '@/contexts/data/domain/Slug'

describe('BLING_ENTITIES', () => {
  it('has 17 entities with unique slugs', () => {
    expect(BLING_ENTITIES).toHaveLength(17)
    expect(new Set(BLING_ENTITIES.map((e) => e.slug)).size).toBe(17)
  })
  it('slug equals Slug.from(name) so seeding is idempotent by slug', () => {
    for (const e of BLING_ENTITIES) expect(Slug.from(e.name).value).toBe(e.slug)
  })
  it('field names match the FieldName regex', () => {
    for (const e of BLING_ENTITIES)
      for (const f of e.fields) expect(f.name).toMatch(/^[a-z][a-z0-9_]*$/)
  })
  it('every relation field names a target slug that exists', () => {
    const slugs = new Set(BLING_ENTITIES.map((e) => e.slug))
    for (const e of BLING_ENTITIES)
      for (const f of e.fields)
        if (f.type.kind === 'relation') {
          expect(f.relationTargetSlug).toBeDefined()
          expect(slugs.has(f.relationTargetSlug!)).toBe(true)
        }
  })
  it('BlingEntitySlug is the literal union, not string', () => {
    const good: BlingEntitySlug = 'bling_produtos'
    // @ts-expect-error not a real slug — must be rejected by the union type
    const bad: BlingEntitySlug = 'not_a_real_slug'
    expect(good).toBe('bling_produtos')
    void bad
  })
})
