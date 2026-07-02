import { describe, it, expect } from 'vitest'
import { mapCategoria } from '@/contexts/bling/domain/mirror/mappers/categorias'
import { mapDeposito } from '@/contexts/bling/domain/mirror/mappers/depositos'
import { mapFormaPagamento } from '@/contexts/bling/domain/mirror/mappers/formasPagamento'
import { mapTipoContato } from '@/contexts/bling/domain/mirror/mappers/tiposContato'

describe('tier1 mappers', () => {
  it('categoria emits descricao + parent relRef', () => {
    expect(mapCategoria({ id: 2, descricao: 'Sub', categoriaPai: { id: 1 } })).toEqual({
      slug: 'bling_categorias_produtos', externalId: '2',
      data: { descricao: 'Sub', categoria_pai: { __rel: true, slug: 'bling_categorias_produtos', externalId: '1' } },
    })
  })
  it('categoria root has null parent', () => {
    expect(mapCategoria({ id: 1, descricao: 'Root' }).data.categoria_pai).toBeNull()
  })
  it('deposito maps flags', () => {
    expect(mapDeposito({ id: 5, descricao: 'D', padrao: true }).data).toMatchObject({ descricao: 'D', padrao: true, desconsiderar_saldo: false })
  })
  it('forma pagamento flattens taxas/cartao', () => {
    const d = mapFormaPagamento({ id: 3, descricao: 'PIX', taxas: { valor: 1.5 }, cartao: { bandeira: 'visa' } }).data
    expect(d).toMatchObject({ descricao: 'PIX', taxa_valor: 1.5, cartao_bandeira: 'visa' })
  })
  it('tipo contato maps descricao', () => {
    expect(mapTipoContato({ id: 7, descricao: 'Cliente' })).toEqual({ slug: 'bling_tipos_contato', externalId: '7', data: { descricao: 'Cliente' } })
  })
})
