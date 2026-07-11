import { describe, it, expect } from 'vitest'
import {
  COSTING_ENTITIES, PRODUTOS_NEW_FIELDS, fieldConfig,
  FICHAS_TECNICAS_NEW_FIELDS, FICHAS_EXPLODIDAS_NEW_FIELDS,
  SNAPSHOTS_NEW_FIELDS, PRODUTOS_CUSTO_FIELDS,
} from '@/scripts/costingSchema'
import { Slug } from '@/contexts/data/domain/Slug'

describe('costingSchema', () => {
  it('defines the six costing entities by slug', () => {
    expect(COSTING_ENTITIES.map((e) => e.slug).sort()).toEqual([
      'custos_de_operacao', 'fichas_explodidas', 'fichas_tecnicas',
      'parametros_de_custo', 'snapshots_custo', 'substituicoes',
    ])
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

  it('snapshot data field is a datetime (the service writes a full ISO datetime)', () => {
    const snapshot = COSTING_ENTITIES.find((e) => e.slug === 'snapshots_custo')!
    const data = snapshot.fields.find((f) => f.slug === 'data')!
    expect(fieldConfig(data, () => 'X')).toEqual({ kind: 'datetime' })
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

describe('costingSchema — process engineering additions', () => {
  it('adds the two cost entities', () => {
    expect(COSTING_ENTITIES.map((e) => e.slug).sort()).toEqual([
      'custos_de_operacao', 'fichas_explodidas', 'fichas_tecnicas',
      'parametros_de_custo', 'snapshots_custo', 'substituicoes',
    ])
  })

  it('parametros_de_custo carries key, scope, value and a validity window', () => {
    const p = COSTING_ENTITIES.find((e) => e.slug === 'parametros_de_custo')!
    expect(p.fields.map((f) => f.slug)).toEqual(
      ['chave', 'escopo_centro', 'valor', 'vigencia_inicio', 'vigencia_fim'],
    )
    const chave = p.fields.find((f) => f.slug === 'chave')!
    expect(chave.options).toEqual(['taxa_fixa_min', 'taxa_moi_min', 'taxa_depreciacao_min'])
  })

  it('links a ficha line to the operation that consumes it', () => {
    expect(FICHAS_TECNICAS_NEW_FIELDS.map((f) => f.slug)).toEqual(['operacao'])
    expect(FICHAS_TECNICAS_NEW_FIELDS[0].targetSlug).toBe('operacoes')
  })

  it('snapshot carries the full cost breakdown', () => {
    expect(SNAPSHOTS_NEW_FIELDS.map((f) => f.slug)).toEqual(
      ['custo_materiais', 'custo_mod', 'custo_indireto', 'tempo_total_min',
       'origem_rev_roteiro', 'detalhe_conversao'],
    )
  })

  it('produtos gains the full cost, leaving preco_custo as materials', () => {
    expect(PRODUTOS_CUSTO_FIELDS.map((f) => f.slug)).toEqual(
      ['custo_conversao', 'custo_unitario_total', 'tempo_total_min'],
    )
  })
})
