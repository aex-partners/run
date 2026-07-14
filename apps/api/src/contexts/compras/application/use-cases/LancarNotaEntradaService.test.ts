import { describe, it, expect } from 'vitest'
import { testWorld, E } from '@/contexts/compras/adapters/out/fake/testWorld'
import { FakeEstoqueMovimentos } from '@/contexts/compras/adapters/out/fake/FakeEstoqueMovimentos'
import { LancarNotaEntradaService } from '@/contexts/compras/application/use-cases/LancarNotaEntradaService'
import { CriarPedidoCompraService } from '@/contexts/compras/application/use-cases/CriarPedidoCompraService'

type World = ReturnType<typeof testWorld>

const svc = (w: World, estoque = new FakeEstoqueMovimentos()) => ({
  nota: new LancarNotaEntradaService(w.store, w.store, estoque),
  estoque,
})

const notaBase = {
  numero: '1001', fornecedorId: 'FORN1', dataEmissao: '2026-07-10', dataEntrada: '2026-07-12',
  depositoId: 'DEP1',
}

describe('LancarNotaEntradaService', () => {
  it('custeia a nota, grava a nota e os itens, e empurra a entrada para o estoque', async () => {
    const w = testWorld()
    const { nota, estoque } = svc(w)
    const r = await nota.execute({
      ...notaBase,
      valorFrete: 20,
      itens: [{ insumoId: 'TECIDO', qtd: 10, precoUnitario: 10, imposto: 8, desconto: 5 }],
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return

    // 10 × 10 = 100; − 5; + 20 frete; + 8 imposto = 123. / 10 = 12,30
    expect(r.value.itens[0].custoUnitarioFinal).toBeCloseTo(12.3, 10)
    expect(r.value.itens[0].qtdConsumo).toBeCloseTo(10, 10)
    expect(r.value.itens[0].custoMedioApos).toBeCloseTo(12.3, 10)
    expect(r.value.valorTotal).toBeCloseTo(123, 10)

    // a entrada chegou ao estoque, JÁ EM UNIDADE DE CONSUMO
    expect(estoque.recebidos).toHaveLength(1)
    expect(estoque.recebidos[0]).toMatchObject({
      insumoId: 'TECIDO', depositoId: 'DEP1', origemTipo: 'nota_entrada', origemId: r.value.notaId,
    })
    expect(estoque.recebidos[0].qtd).toBeCloseTo(10, 10)
    expect(estoque.recebidos[0].custoUnitario).toBeCloseTo(12.3, 10)

    const notas = await w.store.query(E.notas, [], 500)
    expect(notas).toHaveLength(1)
    expect(notas[0].data.status).toBe('lancada')
    const itens = await w.store.query(E.itensNota, [], 500)
    expect(itens).toHaveLength(1)
    expect(itens[0].data.custo_unitario_final).toBeCloseTo(12.3, 10)
    expect(itens[0].data.frete_rateado).toBeCloseTo(20, 10)
  })

  // O CASO REAL: 15 M2 comprados, consumidos em metro linear (fator 2).
  it('converte a unidade de compra para a unidade de consumo antes de mover o estoque', async () => {
    const w = testWorld([{ id: 'SARJA', fatorConversao: 2 }])
    const { nota, estoque } = svc(w)
    const r = await nota.execute({
      ...notaBase,
      itens: [{ insumoId: 'SARJA', qtd: 15, precoUnitario: 250 }],
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    // 15 × 250 = 3750; 15 × 2 = 30 unidades de consumo; 3750 / 30 = 125
    expect(estoque.recebidos[0].qtd).toBeCloseTo(30, 10)
    expect(estoque.recebidos[0].custoUnitario).toBeCloseTo(125, 10)
  })

  it('rateia o frete entre os itens, proporcional ao valor', async () => {
    const w = testWorld([{ id: 'A' }, { id: 'B' }])
    const { nota } = svc(w)
    const r = await nota.execute({
      ...notaBase,
      valorFrete: 200,
      itens: [
        { insumoId: 'A', qtd: 1, precoUnitario: 300 },   // 75%
        { insumoId: 'B', qtd: 1, precoUnitario: 100 },   // 25%
      ],
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.itens[0].freteRateado).toBeCloseTo(150, 10)
    expect(r.value.itens[1].freteRateado).toBeCloseTo(50, 10)
  })

  it('respeita a política gravada: frete desligado sai do custo', async () => {
    const w = testWorld()
    w.store.seedRecord(E.politica, {
      id: 'POL', version: 1,
      data: { incluir_frete: false, incluir_impostos: true, incluir_descontos: true, criterio_rateio_frete: 'valor' },
    })
    const { nota, estoque } = svc(w)
    const r = await nota.execute({
      ...notaBase, valorFrete: 50,
      itens: [{ insumoId: 'TECIDO', qtd: 10, precoUnitario: 10 }],
    })
    expect(r.ok).toBe(true)
    expect(estoque.recebidos[0].custoUnitario).toBeCloseTo(10, 10)   // sem o frete
  })

  it('sem linha de política, usa o padrão: tudo ligado, rateio por valor', async () => {
    const w = testWorld()
    const { nota, estoque } = svc(w)
    await nota.execute({
      ...notaBase, valorFrete: 50,
      itens: [{ insumoId: 'TECIDO', qtd: 10, precoUnitario: 10 }],
    })
    expect(estoque.recebidos[0].custoUnitario).toBeCloseTo(15, 10)   // (100 + 50) / 10
  })

  // Compra direta, sem pedido: normal, e ignorar isso trava o usuário no dia 2.
  it('nota SEM pedido é aceita', async () => {
    const w = testWorld()
    const { nota } = svc(w)
    const r = await nota.execute({
      ...notaBase, pedidoId: null,
      itens: [{ insumoId: 'TECIDO', qtd: 10, precoUnitario: 10 }],
    })
    expect(r.ok).toBe(true)
    const notas = await w.store.query(E.notas, [], 500)
    expect(notas[0].data.pedido).toBeNull()
  })

  it('nota contra pedido atualiza qtd_recebida e fecha o pedido como recebido', async () => {
    const w = testWorld()
    const pedidoSvc = new CriarPedidoCompraService(w.store, w.store)
    const p = await pedidoSvc.execute({
      numero: 'PC-1', fornecedorId: 'FORN1', data: '2026-07-01',
      itens: [{ insumoId: 'TECIDO', qtd: 10, precoUnitario: 10 }],
    })
    expect(p.ok).toBe(true)
    if (!p.ok) return

    const { nota } = svc(w)
    const r = await nota.execute({
      ...notaBase, pedidoId: p.value.pedidoId,
      itens: [{ insumoId: 'TECIDO', qtd: 10, precoUnitario: 10 }],
    })
    expect(r.ok).toBe(true)

    const itensPedido = await w.store.query(E.itensPedido, [{ field: 'pedido', op: 'eq', value: p.value.pedidoId }], 500)
    expect(itensPedido[0].data.qtd_recebida).toBe(10)
    const pedido = await w.store.get(p.value.pedidoId)
    expect(pedido!.data.status).toBe('recebido')
  })

  it('entrega parcial deixa o pedido como parcial', async () => {
    const w = testWorld()
    const pedidoSvc = new CriarPedidoCompraService(w.store, w.store)
    const p = await pedidoSvc.execute({
      numero: 'PC-2', fornecedorId: 'FORN1', data: '2026-07-01',
      itens: [{ insumoId: 'TECIDO', qtd: 100, precoUnitario: 10 }],
    })
    if (!p.ok) return

    const { nota } = svc(w)
    await nota.execute({
      ...notaBase, pedidoId: p.value.pedidoId,
      itens: [{ insumoId: 'TECIDO', qtd: 40, precoUnitario: 10 }],
    })
    const pedido = await w.store.get(p.value.pedidoId)
    expect(pedido!.data.status).toBe('parcial')
    const itensPedido = await w.store.query(E.itensPedido, [{ field: 'pedido', op: 'eq', value: p.value.pedidoId }], 500)
    expect(itensPedido[0].data.qtd_recebida).toBe(40)
  })

  it('a segunda nota do mesmo pedido soma na qtd_recebida e fecha o pedido', async () => {
    const w = testWorld()
    const pedidoSvc = new CriarPedidoCompraService(w.store, w.store)
    const p = await pedidoSvc.execute({
      numero: 'PC-3', fornecedorId: 'FORN1', data: '2026-07-01',
      itens: [{ insumoId: 'TECIDO', qtd: 100, precoUnitario: 10 }],
    })
    if (!p.ok) return
    const { nota } = svc(w)
    await nota.execute({ ...notaBase, numero: 'N1', pedidoId: p.value.pedidoId, itens: [{ insumoId: 'TECIDO', qtd: 40, precoUnitario: 10 }] })
    await nota.execute({ ...notaBase, numero: 'N2', pedidoId: p.value.pedidoId, itens: [{ insumoId: 'TECIDO', qtd: 60, precoUnitario: 10 }] })

    const itensPedido = await w.store.query(E.itensPedido, [{ field: 'pedido', op: 'eq', value: p.value.pedidoId }], 500)
    expect(itensPedido[0].data.qtd_recebida).toBe(100)
    const pedido = await w.store.get(p.value.pedidoId)
    expect(pedido!.data.status).toBe('recebido')
  })

  it('duas entradas do mesmo insumo ponderam o custo médio', async () => {
    const w = testWorld()
    const { nota, estoque } = svc(w)
    await nota.execute({ ...notaBase, numero: 'N1', itens: [{ insumoId: 'TECIDO', qtd: 100, precoUnitario: 10 }] })
    const r = await nota.execute({ ...notaBase, numero: 'N2', itens: [{ insumoId: 'TECIDO', qtd: 100, precoUnitario: 20 }] })
    expect(r.ok && r.value.itens[0].custoMedioApos).toBeCloseTo(15, 10)
    expect(estoque.recebidos).toHaveLength(2)
  })

  // --- DUROS: nada é gravado, a nota não lança.
  it('fator de conversão inválido recusa a nota, e NADA é gravado', async () => {
    const w = testWorld([{ id: 'TECIDO', fatorConversao: 0 }])
    const { nota, estoque } = svc(w)
    const r = await nota.execute({ ...notaBase, itens: [{ insumoId: 'TECIDO', qtd: 10, precoUnitario: 10 }] })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toContain('fator_conversao')
    expect(await w.store.query(E.notas, [], 500)).toHaveLength(0)
    expect(estoque.recebidos).toHaveLength(0)
  })

  it('insumo sem controla_estoque recusa a nota ANTES de gravar', async () => {
    const w = testWorld([{ id: 'BOTAO', controlaEstoque: false }])
    const { nota, estoque } = svc(w)
    const r = await nota.execute({ ...notaBase, itens: [{ insumoId: 'BOTAO', qtd: 10, precoUnitario: 1 }] })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toContain('controla_estoque')
    expect(await w.store.query(E.notas, [], 500)).toHaveLength(0)
    expect(estoque.recebidos).toHaveLength(0)
  })

  it('insumo inexistente recusa a nota', async () => {
    const w = testWorld()
    const { nota } = svc(w)
    const r = await nota.execute({ ...notaBase, itens: [{ insumoId: 'FANTASMA', qtd: 1, precoUnitario: 1 }] })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toContain('FANTASMA')
  })

  it('nota sem itens é recusada', async () => {
    const w = testWorld()
    const { nota } = svc(w)
    const r = await nota.execute({ ...notaBase, itens: [] })
    expect(r.ok).toBe(false)
  })

  it('pedido inexistente é recusado', async () => {
    const w = testWorld()
    const { nota } = svc(w)
    const r = await nota.execute({
      ...notaBase, pedidoId: 'NAO_EXISTE',
      itens: [{ insumoId: 'TECIDO', qtd: 1, precoUnitario: 1 }],
    })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toContain('pedido')
  })

  // SEM TRANSAÇÃO: se um movimento falhar no meio, a nota fica em RASCUNHO e o erro diz
  // exatamente o que fazer. Torto e calado, nunca.
  it('falha de movimento no meio deixa a nota em rascunho e falha ALTO', async () => {
    const w = testWorld([{ id: 'A' }, { id: 'B' }])
    const estoque = new FakeEstoqueMovimentos((m) => m.insumoId === 'B')
    const nota = new LancarNotaEntradaService(w.store, w.store, estoque)
    const r = await nota.execute({
      ...notaBase,
      itens: [
        { insumoId: 'A', qtd: 10, precoUnitario: 10 },
        { insumoId: 'B', qtd: 10, precoUnitario: 10 },
      ],
    })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toContain('RASCUNHO')
    expect(!r.ok && r.error).toContain('replay-estoque')

    const notas = await w.store.query(E.notas, [], 500)
    expect(notas).toHaveLength(1)
    expect(notas[0].data.status).toBe('rascunho')
    // O movimento de A foi registrado; o de B não. É por isso que o erro manda rodar o replay.
    expect(estoque.recebidos.map((m) => m.insumoId)).toEqual(['A'])
  })

  // O `estoque` recusa custo <= 0 (zeraria o custo médio em silêncio). `custearNota` pode
  // produzir custo zero legitimamente. Barrar ANTES de gravar: senão a nota fica presa em
  // `rascunho` e o usuário recebe um erro de "movimento parcial" que não descreve o que houve.
  it('item com custo final ZERO recusa a nota ANTES de gravar', async () => {
    const w = testWorld()
    const { nota, estoque } = svc(w)
    const r = await nota.execute({
      ...notaBase,
      itens: [{ insumoId: 'TECIDO', qtd: 10, precoUnitario: 0 }],
    })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toContain('TECIDO')
    expect(!r.ok && r.error).toContain('custo unitário ZERO')
    // NADA foi gravado, e nenhum movimento foi empurrado para o estoque.
    expect(await w.store.query(E.notas, [], 500)).toHaveLength(0)
    expect(await w.store.query(E.itensNota, [], 500)).toHaveLength(0)
    expect(estoque.recebidos).toHaveLength(0)
  })

  // Desconto que anula o item inteiro cai na mesma armadilha.
  it('desconto que zera o custo do item recusa a nota', async () => {
    const w = testWorld()
    const { nota, estoque } = svc(w)
    const r = await nota.execute({
      ...notaBase,
      itens: [{ insumoId: 'TECIDO', qtd: 10, precoUnitario: 10, desconto: 100 }],
    })
    expect(r.ok).toBe(false)
    expect(await w.store.query(E.notas, [], 500)).toHaveLength(0)
    expect(estoque.recebidos).toHaveLength(0)
  })

  // Um item bom junto de um zerado: a nota inteira é recusada. O custo é da NOTA, não do item:
  // deixar passar os bons e recusar o zerado gravaria uma nota que não bate com o documento.
  it('um item zerado recusa a nota INTEIRA, mesmo com outros itens bons', async () => {
    const w = testWorld([{ id: 'A' }, { id: 'B' }])
    const { nota, estoque } = svc(w)
    const r = await nota.execute({
      ...notaBase,
      itens: [
        { insumoId: 'A', qtd: 10, precoUnitario: 10 },
        { insumoId: 'B', qtd: 5, precoUnitario: 0 },
      ],
    })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toContain('B')
    expect(await w.store.query(E.notas, [], 500)).toHaveLength(0)
    expect(estoque.recebidos).toHaveLength(0)
  })

  // Um custo POSITIVO mas minúsculo é legítimo e passa (não confundir "zero" com "barato").
  it('custo positivo pequeno passa normalmente', async () => {
    const w = testWorld()
    const { nota } = svc(w)
    const r = await nota.execute({
      ...notaBase,
      itens: [{ insumoId: 'TECIDO', qtd: 1000, precoUnitario: 0.01 }],
    })
    expect(r.ok).toBe(true)
  })
})
