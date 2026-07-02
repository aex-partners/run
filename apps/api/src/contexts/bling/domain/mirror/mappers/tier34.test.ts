import { describe, it, expect } from 'vitest'
import { mapProduto } from '@/contexts/bling/domain/mirror/mappers/produtos'
import { mapPedidoVenda } from '@/contexts/bling/domain/mirror/mappers/pedidosVendas'

describe('produtos/pedidos mappers', () => {
  it('produto emits self + children with parent relRef', () => {
    const out = mapProduto({ id: 1, nome: 'P', categoria: { id: 9 },
      variacoes: [{ id: 2, nome: 'v' }], midia: { imagens: { externas: [{ id: 3, link: 'http://x' }] } } } as never)
    expect(out[0]).toMatchObject({ slug: 'bling_produtos', externalId: '1' })
    expect(out[0].data.categoria).toEqual({ __rel: true, slug: 'bling_categorias_produtos', externalId: '9' })
    expect(out.find((r) => r.slug === 'bling_produto_variacoes')!.data.produto_pai).toEqual({ __rel: true, slug: 'bling_produtos', externalId: '1' })
    expect(out.find((r) => r.slug === 'bling_produto_imagens_externas')!.data.link).toBe('http://x')
  })
  it('pedido emits self + itens; contato is a relRef', () => {
    const out = mapPedidoVenda({ id: 5, data: '2026-01-01', contato: { id: 10 },
      itens: [{ quantidade: 2, valor: 3, descricao: 'x', produto: { id: 1 } }] } as never)
    expect(out[0]).toMatchObject({ slug: 'bling_pedidos_venda', externalId: '5' })
    expect(out[0].data.contato).toEqual({ __rel: true, slug: 'bling_contatos', externalId: '10' })
    const item = out.find((r) => r.slug === 'bling_pedido_venda_itens')!
    expect(item.data.pedido).toEqual({ __rel: true, slug: 'bling_pedidos_venda', externalId: '5' })
    expect(item.data.produto).toEqual({ __rel: true, slug: 'bling_produtos', externalId: '1' })
  })
})
