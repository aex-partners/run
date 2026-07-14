import { describe, it, expect } from 'vitest'
import { ESTOQUE_ENTITIES, PRODUTOS_ESTOQUE_FIELDS } from '@/scripts/estoqueSchema'
import { fieldConfig } from '@/scripts/schemaSpec'
import { Slug } from '@/contexts/data/domain/Slug'

describe('estoqueSchema', () => {
  it('define as três entidades do estoque por slug', () => {
    expect(ESTOQUE_ENTITIES.map((e) => e.slug).sort())
      .toEqual(['depositos', 'movimentos_de_estoque', 'saldos_de_estoque'])
  })

  // O script de provisionamento pula por slug. Uma derivação errada cria entidade
  // DUPLICADA em produção, e o motor passa a ler a errada.
  it('todo displayName deriva exatamente no slug declarado', () => {
    for (const e of ESTOQUE_ENTITIES) expect(Slug.from(e.displayName).value).toBe(e.slug)
  })

  it('movimentos_de_estoque carrega o snapshot de saldo e custo médio APÓS o movimento', () => {
    const mov = ESTOQUE_ENTITIES.find((e) => e.slug === 'movimentos_de_estoque')!
    const slugs = mov.fields.map((f) => f.slug)
    expect(slugs).toContain('saldo_total_apos')
    expect(slugs).toContain('saldo_deposito_apos')
    expect(slugs).toContain('custo_medio_apos')
  })

  it('os seis tipos de movimento da fase 1', () => {
    const mov = ESTOQUE_ENTITIES.find((e) => e.slug === 'movimentos_de_estoque')!
    const tipo = mov.fields.find((f) => f.slug === 'tipo')!
    expect(tipo.options).toEqual([
      'entrada_nota', 'inventario_abertura', 'ajuste', 'contagem',
      'devolucao_fornecedor', 'saida_manual',
    ])
  })

  it('acrescenta a produtos a conversão de unidade, o flag de estoque e o custo médio', () => {
    expect(PRODUTOS_ESTOQUE_FIELDS.map((f) => f.slug).sort()).toEqual([
      'controla_estoque', 'custo_medio', 'custo_medio_atualizado_em',
      'fator_conversao', 'preco_custo', 'saldo_total', 'unidade_compra', 'unidade_consumo',
    ])
    const custoMedio = PRODUTOS_ESTOQUE_FIELDS.find((f) => f.slug === 'custo_medio')!
    expect(fieldConfig(custoMedio, () => null))
      .toEqual({ kind: 'currency', currencyCode: 'BRL', decimalPlaces: 4 })
  })

  it('resolve a relação insumo para produtos', () => {
    const mov = ESTOQUE_ENTITIES.find((e) => e.slug === 'movimentos_de_estoque')!
    const insumo = mov.fields.find((f) => f.slug === 'insumo')!
    expect(fieldConfig(insumo, (slug) => (slug === 'produtos' ? 'P' : null)))
      .toEqual({ kind: 'relation', targetEntityId: 'P' })
  })
})
