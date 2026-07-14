import { describe, it, expect } from 'vitest'
import { COMPRAS_ENTITIES } from '@/scripts/comprasSchema'
import { fieldConfig } from '@/scripts/schemaSpec'
import { Slug } from '@/contexts/data/domain/Slug'

describe('comprasSchema', () => {
  it('define as cinco entidades de compras por slug', () => {
    expect(COMPRAS_ENTITIES.map((e) => e.slug).sort()).toEqual([
      'itens_nota_entrada', 'itens_pedido_compra', 'notas_de_entrada',
      'pedidos_de_compra', 'politica_de_custo_compra',
    ])
  })

  it('todo displayName deriva exatamente no slug declarado', () => {
    for (const e of COMPRAS_ENTITIES) expect(Slug.from(e.displayName).value).toBe(e.slug)
  })

  // Compra direta (sem pedido) é normal. A relação existe, mas o motor aceita nulo.
  it('a nota de entrada relaciona pedido e depósito', () => {
    const nota = COMPRAS_ENTITIES.find((e) => e.slug === 'notas_de_entrada')!
    const pedido = nota.fields.find((f) => f.slug === 'pedido')!
    expect(fieldConfig(pedido, (s) => (s === 'pedidos_de_compra' ? 'PC' : null)))
      .toEqual({ kind: 'relation', targetEntityId: 'PC' })
    const deposito = nota.fields.find((f) => f.slug === 'deposito')!
    expect(fieldConfig(deposito, (s) => (s === 'depositos' ? 'D' : null)))
      .toEqual({ kind: 'relation', targetEntityId: 'D' })
  })

  // Gancho da Fase 5 (contas a pagar): TEXTO, não relação. Não existe entidade
  // condicoes_de_pagamento neste banco.
  it('condicao_pagamento da nota é texto, não relação', () => {
    const nota = COMPRAS_ENTITIES.find((e) => e.slug === 'notas_de_entrada')!
    const cond = nota.fields.find((f) => f.slug === 'condicao_pagamento')!
    expect(cond.kind).toBe('text')
  })

  it('o item da nota carrega o frete rateado e o custo final, ambos gravados pelo motor', () => {
    const item = COMPRAS_ENTITIES.find((e) => e.slug === 'itens_nota_entrada')!
    const slugs = item.fields.map((f) => f.slug)
    expect(slugs).toContain('frete_rateado')
    expect(slugs).toContain('custo_unitario_final')
  })

  it('a política de custo tem os três liga-desliga e o critério de rateio', () => {
    const pol = COMPRAS_ENTITIES.find((e) => e.slug === 'politica_de_custo_compra')!
    expect(pol.fields.map((f) => f.slug).sort()).toEqual([
      'criterio_rateio_frete', 'incluir_descontos', 'incluir_frete', 'incluir_impostos',
    ])
    const criterio = pol.fields.find((f) => f.slug === 'criterio_rateio_frete')!
    expect(criterio.options).toEqual(['valor', 'quantidade'])
  })
})
