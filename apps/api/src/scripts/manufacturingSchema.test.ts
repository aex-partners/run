import { describe, it, expect } from 'vitest'
import { Slug } from '@/contexts/data/domain/Slug'
import { MANUFACTURING_ENTITIES } from '@/scripts/manufacturingSchema'
import { fieldConfig } from '@/scripts/schemaSpec'

describe('manufacturingSchema', () => {
  it('defines the two manufacturing entities', () => {
    expect(MANUFACTURING_ENTITIES.map((e) => e.slug).sort()).toEqual(['centros_de_trabalho', 'operacoes'])
  })

  it('every displayName derives to its declared slug', () => {
    for (const e of MANUFACTURING_ENTITIES) expect(Slug.from(e.displayName).value).toBe(e.slug)
  })

  it('work center carries a 4-decimal BRL cost per minute', () => {
    const centro = MANUFACTURING_ENTITIES.find((e) => e.slug === 'centros_de_trabalho')!
    expect(centro.fields.map((f) => f.slug)).toEqual(
      ['nome', 'setor', 'custo_min_mod', 'capacidade_min_dia', 'num_operadores', 'ativo'],
    )
    const custo = centro.fields.find((f) => f.slug === 'custo_min_mod')!
    expect(fieldConfig(custo, () => null)).toEqual({ kind: 'currency', currencyCode: 'BRL', decimalPlaces: 4 })
  })

  it('operacoes carries the routing fields with the revision model', () => {
    const op = MANUFACTURING_ENTITIES.find((e) => e.slug === 'operacoes')!
    expect(op.fields.map((f) => f.slug)).toEqual([
      'modelo', 'codigo', 'seq', 'nome', 'centro', 'tempo_padrao_min', 'tempo_por_tamanho',
      'tempo_setup_min', 'lote_setup', 'agregada', 'rev', 'status',
    ])
    const tempo = op.fields.find((f) => f.slug === 'tempo_padrao_min')!
    expect(fieldConfig(tempo, () => null)).toEqual({ kind: 'duration' })
  })

  // A identidade ESTÁVEL da operação dentro do modelo. É TEXT, não relação: sobrevive a
  // cada revisão (que cria linhas novas de `operacoes`) e é por ele que a ficha técnica
  // atribui o insumo à operação que o consome.
  it('operacoes carries a stable text codigo (survives every revision)', () => {
    const op = MANUFACTURING_ENTITIES.find((e) => e.slug === 'operacoes')!
    const codigo = op.fields.find((f) => f.slug === 'codigo')!
    expect(fieldConfig(codigo, () => null)).toEqual({ kind: 'text' })
    expect(codigo.targetSlug).toBeUndefined()
  })
})
