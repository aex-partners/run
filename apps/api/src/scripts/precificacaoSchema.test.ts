import { describe, it, expect } from 'vitest'
import { PRECIFICACAO_ENTITIES, CONDICOES_PRECO_FIELDS } from '@/scripts/precificacaoSchema'
import { fieldConfig } from '@/scripts/schemaSpec'
import { Slug } from '@/contexts/data/domain/Slug'

describe('precificacaoSchema', () => {
  it('define as quatro entidades por slug', () => {
    expect(PRECIFICACAO_ENTITIES.map((e) => e.slug).sort())
      .toEqual(['canais_de_venda', 'parametros_de_preco', 'politica_de_preco', 'precos_de_venda'])
  })

  it('todo displayName deriva exatamente no slug', () => {
    for (const e of PRECIFICACAO_ENTITIES) expect(Slug.from(e.displayName).value).toBe(e.slug)
  })

  it('a comissão do canal é percent', () => {
    const canal = PRECIFICACAO_ENTITIES.find((e) => e.slug === 'canais_de_venda')!
    const comissao = canal.fields.find((f) => f.slug === 'comissao')!
    expect(fieldConfig(comissao, () => null)).toEqual({ kind: 'percent' })
  })

  it('preco de venda relaciona sku, canal e condicao e carrega custo_base + componentes', () => {
    const pv = PRECIFICACAO_ENTITIES.find((e) => e.slug === 'precos_de_venda')!
    const slugs = pv.fields.map((f) => f.slug)
    expect(slugs).toContain('sku'); expect(slugs).toContain('canal'); expect(slugs).toContain('condicao')
    expect(slugs).toContain('preco'); expect(slugs).toContain('custo_base'); expect(slugs).toContain('componentes')
    const sku = pv.fields.find((f) => f.slug === 'sku')!
    expect(fieldConfig(sku, (s) => (s === 'produtos' ? 'P' : null))).toEqual({ kind: 'relation', targetEntityId: 'P' })
  })

  it('política de preço liga modelo, canal e lucro_alvo', () => {
    const pol = PRECIFICACAO_ENTITIES.find((e) => e.slug === 'politica_de_preco')!
    expect(pol.fields.map((f) => f.slug).sort()).toEqual(['canal', 'lucro_alvo', 'modelo'])
  })

  it('acrescenta desp_financeira (percent) a condicoes_pagamento', () => {
    expect(CONDICOES_PRECO_FIELDS.map((f) => f.slug)).toEqual(['desp_financeira'])
    expect(fieldConfig(CONDICOES_PRECO_FIELDS[0]!, () => null)).toEqual({ kind: 'percent' })
  })
})
