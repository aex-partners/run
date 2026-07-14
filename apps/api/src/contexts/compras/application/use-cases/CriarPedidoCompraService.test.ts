import { describe, it, expect } from 'vitest'
import { testWorld, E } from '@/contexts/compras/adapters/out/fake/testWorld'
import { CriarPedidoCompraService } from '@/contexts/compras/application/use-cases/CriarPedidoCompraService'
import { ConsultarPedidoCompraService } from '@/contexts/compras/application/use-cases/ConsultarPedidoCompraService'

describe('CriarPedidoCompraService', () => {
  it('grava o pedido, os itens e o valor total', async () => {
    const w = testWorld([{ id: 'A' }, { id: 'B' }])
    const r = await new CriarPedidoCompraService(w.store, w.store).execute({
      numero: 'PC-1', fornecedorId: 'FORN1', data: '2026-07-01', previsaoEntrega: '2026-07-20',
      itens: [
        { insumoId: 'A', qtd: 10, precoUnitario: 10 },
        { insumoId: 'B', qtd: 2, precoUnitario: 250 },
      ],
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.valorTotal).toBeCloseTo(600, 10)   // 100 + 500

    const pedido = await w.store.get(r.value.pedidoId)
    expect(pedido!.data.status).toBe('enviado')
    expect(pedido!.data.valor_total).toBeCloseTo(600, 10)

    const itens = await w.store.query(E.itensPedido, [{ field: 'pedido', op: 'eq', value: r.value.pedidoId }], 500)
    expect(itens).toHaveLength(2)
    // qtd_recebida nasce zerada: é o motor da nota que a alimenta.
    expect(itens.every((i) => i.data.qtd_recebida === 0)).toBe(true)
  })

  it('pedido sem itens é recusado', async () => {
    const w = testWorld()
    const r = await new CriarPedidoCompraService(w.store, w.store).execute({
      numero: 'PC-X', fornecedorId: 'FORN1', data: '2026-07-01', itens: [],
    })
    expect(r.ok).toBe(false)
  })

  it('insumo inexistente é recusado', async () => {
    const w = testWorld()
    const r = await new CriarPedidoCompraService(w.store, w.store).execute({
      numero: 'PC-X', fornecedorId: 'FORN1', data: '2026-07-01',
      itens: [{ insumoId: 'FANTASMA', qtd: 1, precoUnitario: 1 }],
    })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toContain('FANTASMA')
  })
})

describe('ConsultarPedidoCompraService', () => {
  it('devolve o pedido com os itens e o que já foi recebido', async () => {
    const w = testWorld()
    const criado = await new CriarPedidoCompraService(w.store, w.store).execute({
      numero: 'PC-9', fornecedorId: 'FORN1', data: '2026-07-01',
      itens: [{ insumoId: 'TECIDO', qtd: 10, precoUnitario: 10 }],
    })
    if (!criado.ok) return

    const r = await new ConsultarPedidoCompraService(w.store, w.store).execute({ pedidoId: criado.value.pedidoId })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.numero).toBe('PC-9')
    expect(r.value.status).toBe('enviado')
    expect(r.value.itens).toEqual([{ insumoId: 'TECIDO', qtd: 10, precoUnitario: 10, qtdRecebida: 0 }])
  })

  it('pedido inexistente é recusado', async () => {
    const w = testWorld()
    const r = await new ConsultarPedidoCompraService(w.store, w.store).execute({ pedidoId: 'NAO_EXISTE' })
    expect(r.ok).toBe(false)
  })
})
