import { describe, it, expect } from 'vitest'
import { COSTING_ENTITIES, PRODUTOS_NEW_FIELDS, fieldConfig } from '@/scripts/costingSchema'
import { Slug } from '@/contexts/data/domain/Slug'

describe('costingSchema', () => {
  it('defines the four costing entities by slug', () => {
    expect(COSTING_ENTITIES.map((e) => e.slug).sort()).toEqual(
      ['fichas_explodidas', 'fichas_tecnicas', 'snapshots_custo', 'substituicoes'],
    )
  })

  it('every entity displayName derives to its declared slug', () => {
    for (const e of COSTING_ENTITIES) expect(Slug.from(e.displayName).value).toBe(e.slug)
  })

  it('adds fantasma (boolean) and resolve_por (relation) to Produtos', () => {
    expect(PRODUTOS_NEW_FIELDS.map((f) => f.slug).sort()).toEqual(['fantasma', 'resolve_por'])
    const fantasma = PRODUTOS_NEW_FIELDS.find((f) => f.slug === 'fantasma')!
    expect(fieldConfig(fantasma, () => 'X')).toEqual({ kind: 'boolean' })
  })

  it('resolves a relation field to the target entity id', () => {
    const resolvePor = PRODUTOS_NEW_FIELDS.find((f) => f.slug === 'resolve_por')!
    expect(fieldConfig(resolvePor, (slug) => (slug === 'tipos_de_variacao' ? 'TDV' : null)))
      .toEqual({ kind: 'relation', targetEntityId: 'TDV' })
  })

  it('ficha line has item (relation to produtos) and qty_por_tamanho (long_text json)', () => {
    const ficha = COSTING_ENTITIES.find((e) => e.slug === 'fichas_tecnicas')!
    expect(ficha.fields.map((f) => f.slug)).toEqual(
      ['modelo', 'item', 'unidade', 'qty_base', 'qty_por_tamanho', 'rev', 'status'],
    )
    const qpt = ficha.fields.find((f) => f.slug === 'qty_por_tamanho')!
    expect(fieldConfig(qpt, () => 'X')).toEqual({ kind: 'long_text' })
  })
})
