import { describe, it, expect } from 'vitest'
import { testWorld, E } from '@/contexts/compras/adapters/out/fake/testWorld'
import { FakeEstoqueMovimentos } from '@/contexts/compras/adapters/out/fake/FakeEstoqueMovimentos'
import { LancarNotaEntradaService } from '@/contexts/compras/application/use-cases/LancarNotaEntradaService'
import { CriarPedidoCompraService } from '@/contexts/compras/application/use-cases/CriarPedidoCompraService'
import { RecordStore } from '@/contexts/compras/application/ports/out/RecordStore'

type World = ReturnType<typeof testWorld>

const svc = (
  w: World,
  estoque = new FakeEstoqueMovimentos({ depositosConhecidos: w.depositosConhecidos, produtos: w.produtos }),
) => ({
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
    const estoque = new FakeEstoqueMovimentos({
      depositosConhecidos: w.depositosConhecidos,
      produtos: w.produtos,
      falharEm: (m) => m.insumoId === 'B',
    })
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

  // --- FINDING 1: idempotência. Sem guarda, um retry cego pondera o custo médio duas vezes.
  it('a mesma nota (numero + fornecedor) não pode ser lançada duas vezes: NADA é gravado na segunda vez', async () => {
    const w = testWorld()
    const { nota, estoque } = svc(w)
    // Estoque inicial: 100 @ 10 (nota distinta) -> avg 10
    await nota.execute({ ...notaBase, numero: 'N1', itens: [{ insumoId: 'TECIDO', qtd: 100, precoUnitario: 10 }] })
    // Nota real: 100 @ 20 -> avg correto: (100*10 + 100*20)/200 = 15
    const primeira = await nota.execute({ ...notaBase, numero: 'N2', itens: [{ insumoId: 'TECIDO', qtd: 100, precoUnitario: 20 }] })
    expect(primeira.ok).toBe(true)
    expect(primeira.ok && primeira.value.itens[0].custoMedioApos).toBeCloseTo(15, 10)

    // Retry cego da MESMA nota N2 (duplo clique / retry de MCP / timeout de HTTP).
    const segunda = await nota.execute({ ...notaBase, numero: 'N2', itens: [{ insumoId: 'TECIDO', qtd: 100, precoUnitario: 20 }] })

    expect(segunda.ok).toBe(false)
    expect(!segunda.ok && segunda.error).toContain('N2')
    expect(!segunda.ok && segunda.error).toContain('DUAS vezes')

    // O médio continua correto (15, não 16,666...), e NENHUM registro ou movimento novo
    // foi produzido pela tentativa de duplicar.
    expect(estoque.recebidos).toHaveLength(2)   // só N1 e a N2 original
    const notas = await w.store.query(E.notas, [], 500)
    expect(notas).toHaveLength(2)               // só N1 e a N2 original
    const itens = await w.store.query(E.itensNota, [], 500)
    expect(itens).toHaveLength(2)               // um item por nota, nenhum a mais
  })

  it('o mesmo numero de nota de um fornecedor DIFERENTE é aceito (a chave é numero + fornecedor)', async () => {
    const w = testWorld()
    w.store.seedRecord(E.pessoas, { id: 'FORN2', version: 1, data: { nome: 'Outro Fornecedor' } })
    const { nota } = svc(w)
    const primeira = await nota.execute({ ...notaBase, numero: 'N1', fornecedorId: 'FORN1', itens: [{ insumoId: 'TECIDO', qtd: 10, precoUnitario: 10 }] })
    const segunda = await nota.execute({ ...notaBase, numero: 'N1', fornecedorId: 'FORN2', itens: [{ insumoId: 'TECIDO', qtd: 10, precoUnitario: 10 }] })
    expect(primeira.ok).toBe(true)
    expect(segunda.ok).toBe(true)
    expect(await w.store.query(E.notas, [], 500)).toHaveLength(2)
  })

  it('a mesma chave_nfe não pode se repetir, mesmo com numero diferente', async () => {
    const w = testWorld()
    const { nota } = svc(w)
    const primeira = await nota.execute({ ...notaBase, numero: 'N1', chaveNfe: 'CHV-1', itens: [{ insumoId: 'TECIDO', qtd: 10, precoUnitario: 10 }] })
    const segunda = await nota.execute({ ...notaBase, numero: 'N2', chaveNfe: 'CHV-1', itens: [{ insumoId: 'TECIDO', qtd: 10, precoUnitario: 10 }] })
    expect(primeira.ok).toBe(true)
    expect(segunda.ok).toBe(false)
    expect(await w.store.query(E.notas, [], 500)).toHaveLength(1)
  })

  // --- FINDING 2: depositoId é validado contra a entidade `depositos`.
  it('um depositoId desconhecido recusa a nota ANTES de gravar', async () => {
    const w = testWorld()
    const { nota, estoque } = svc(w)
    const r = await nota.execute({
      ...notaBase, depositoId: 'DEP_FANTASMA',
      itens: [{ insumoId: 'TECIDO', qtd: 10, precoUnitario: 10 }],
    })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toContain('DEP_FANTASMA')
    expect(await w.store.query(E.notas, [], 500)).toHaveLength(0)
    expect(estoque.recebidos).toHaveLength(0)
  })

  // --- FINDING 3: pedidoId é validado contra a entidade `pedidos_de_compra` (não aceita
  // mais qualquer id, como um produto).
  it('um produto id passado como pedidoId é recusado, e NADA é carimbado no produto', async () => {
    const w = testWorld()
    const { nota, estoque } = svc(w)
    const r = await nota.execute({
      ...notaBase,
      pedidoId: 'TECIDO',   // é um id de PRODUTO, não de pedido
      itens: [{ insumoId: 'TECIDO', qtd: 10, precoUnitario: 10 }],
    })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toContain('pedido')
    expect(await w.store.query(E.notas, [], 500)).toHaveLength(0)
    expect(estoque.recebidos).toHaveLength(0)
    const tecido = await w.store.get('TECIDO')
    expect(tecido!.data.status).not.toBe('recebido')
    expect(tecido!.data.status).toBeUndefined()
  })

  // --- FINDING 4 (linhas da nota): identidade é o ÍNDICE, não o insumoId.
  it('o mesmo insumo em DUAS linhas da nota, a preços diferentes, grava cada linha com o SEU PRÓPRIO preço', async () => {
    const w = testWorld()
    const { nota } = svc(w)
    const r = await nota.execute({
      ...notaBase,
      itens: [
        { insumoId: 'TECIDO', qtd: 5, precoUnitario: 10 },   // lote 1: mais barato
        { insumoId: 'TECIDO', qtd: 5, precoUnitario: 20 },   // lote 2: outro preço
      ],
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.itens[0].custoUnitarioFinal).toBeCloseTo(10, 10)
    expect(r.value.itens[1].custoUnitarioFinal).toBeCloseTo(20, 10)

    // `query` devolve NEWEST-FIRST: a segunda linha inserida vem primeiro.
    const itens = await w.store.query(E.itensNota, [], 500)
    expect(itens).toHaveLength(2)
    expect(itens[0].data.preco_unitario).toBeCloseTo(20, 10)
    expect(itens[1].data.preco_unitario).toBeCloseTo(10, 10)
  })

  // --- FINDING 4 (linhas do pedido): consome linha a linha, não soma em todas.
  it('pedido com o mesmo insumo em DUAS linhas (50 + 50) recebendo uma nota de 50 fica PARCIAL, não recebido', async () => {
    const w = testWorld()
    const pedidoSvc = new CriarPedidoCompraService(w.store, w.store)
    const p = await pedidoSvc.execute({
      numero: 'PC-DUP', fornecedorId: 'FORN1', data: '2026-07-01',
      itens: [
        { insumoId: 'TECIDO', qtd: 50, precoUnitario: 10 },
        { insumoId: 'TECIDO', qtd: 50, precoUnitario: 10 },
      ],
    })
    expect(p.ok).toBe(true)
    if (!p.ok) return

    const { nota } = svc(w)
    const r = await nota.execute({
      ...notaBase, pedidoId: p.value.pedidoId,
      itens: [{ insumoId: 'TECIDO', qtd: 50, precoUnitario: 10 }],
    })
    expect(r.ok).toBe(true)

    const pedido = await w.store.get(p.value.pedidoId)
    expect(pedido!.data.status).toBe('parcial')   // NÃO 'recebido': só metade do material chegou

    const itensPedido = await w.store.query(E.itensPedido, [{ field: 'pedido', op: 'eq', value: p.value.pedidoId }], 500)
    const somaRecebida = itensPedido.reduce((s, i) => s + Number(i.data.qtd_recebida), 0)
    expect(somaRecebida).toBe(50)   // os 50 foram para UMA linha, não duplicados nas duas
  })

  it('duas notas de 50 completam as duas linhas de 50 do mesmo insumo, e o pedido fecha recebido', async () => {
    const w = testWorld()
    const pedidoSvc = new CriarPedidoCompraService(w.store, w.store)
    const p = await pedidoSvc.execute({
      numero: 'PC-DUP2', fornecedorId: 'FORN1', data: '2026-07-01',
      itens: [
        { insumoId: 'TECIDO', qtd: 50, precoUnitario: 10 },
        { insumoId: 'TECIDO', qtd: 50, precoUnitario: 10 },
      ],
    })
    if (!p.ok) return
    const { nota } = svc(w)
    await nota.execute({ ...notaBase, numero: 'N1', pedidoId: p.value.pedidoId, itens: [{ insumoId: 'TECIDO', qtd: 50, precoUnitario: 10 }] })
    await nota.execute({ ...notaBase, numero: 'N2', pedidoId: p.value.pedidoId, itens: [{ insumoId: 'TECIDO', qtd: 50, precoUnitario: 10 }] })

    const pedido = await w.store.get(p.value.pedidoId)
    expect(pedido!.data.status).toBe('recebido')
    const itensPedido = await w.store.query(E.itensPedido, [{ field: 'pedido', op: 'eq', value: p.value.pedidoId }], 500)
    expect(itensPedido.every((i) => i.data.qtd_recebida === 50)).toBe(true)
  })

  it('um item que não está no pedido produz um aviso SUAVE, e a nota é lançada mesmo assim', async () => {
    const w = testWorld([{ id: 'TECIDO' }, { id: 'BOTAO' }])
    const pedidoSvc = new CriarPedidoCompraService(w.store, w.store)
    const p = await pedidoSvc.execute({
      numero: 'PC-X2', fornecedorId: 'FORN1', data: '2026-07-01',
      itens: [{ insumoId: 'TECIDO', qtd: 10, precoUnitario: 10 }],
    })
    if (!p.ok) return
    const { nota } = svc(w)
    const r = await nota.execute({
      ...notaBase, pedidoId: p.value.pedidoId,
      itens: [{ insumoId: 'BOTAO', qtd: 5, precoUnitario: 2 }],   // não está no pedido
    })
    expect(r.ok).toBe(true)
    expect(r.ok && r.value.avisos.some((a) => a.includes('BOTAO'))).toBe(true)
  })

  // --- FINDING 8: fator de conversão != 1 não pode contaminar qtd_recebida (unidade de COMPRA).
  it('pedido com insumo de fator_conversao 2: qtd_recebida fica em unidade de COMPRA, não de consumo', async () => {
    const w = testWorld([{ id: 'SARJA', fatorConversao: 2 }])
    const pedidoSvc = new CriarPedidoCompraService(w.store, w.store)
    const p = await pedidoSvc.execute({
      numero: 'PC-FATOR', fornecedorId: 'FORN1', data: '2026-07-01',
      itens: [{ insumoId: 'SARJA', qtd: 15, precoUnitario: 250 }],   // 15 unidades de COMPRA
    })
    expect(p.ok).toBe(true)
    if (!p.ok) return

    const { nota, estoque } = svc(w)
    const r = await nota.execute({
      ...notaBase, pedidoId: p.value.pedidoId,
      itens: [{ insumoId: 'SARJA', qtd: 15, precoUnitario: 250 }],
    })
    expect(r.ok).toBe(true)
    // O estoque recebeu em unidade de CONSUMO (30 = 15 × fator 2)...
    expect(estoque.recebidos[0].qtd).toBeCloseTo(30, 10)
    // ...mas o pedido tem que fechar com 15 (unidade de COMPRA), não 30.
    const itensPedido = await w.store.query(E.itensPedido, [{ field: 'pedido', op: 'eq', value: p.value.pedidoId }], 500)
    expect(itensPedido[0].data.qtd_recebida).toBe(15)
    const pedido = await w.store.get(p.value.pedidoId)
    expect(pedido!.data.status).toBe('recebido')
  })

  // --- FINDING 6: erros SUAVES do estoque (ex.: falha de projeção) não podem ser engolidos.
  it('um erro suave devolvido pelo estoque (falha de projeção) surge em avisos, e a nota é lançada mesmo assim', async () => {
    const w = testWorld()
    const estoque = new FakeEstoqueMovimentos({
      depositosConhecidos: w.depositosConhecidos,
      produtos: w.produtos,
      errosEm: (m) => (m.insumoId === 'TECIDO' ? ['projeção de custo_medio falhou: conflito de versão'] : []),
    })
    const nota = new LancarNotaEntradaService(w.store, w.store, estoque)
    const r = await nota.execute({ ...notaBase, itens: [{ insumoId: 'TECIDO', qtd: 10, precoUnitario: 10 }] })
    expect(r.ok).toBe(true)
    expect(r.ok && r.value.avisos.some((a) => a.includes('TECIDO') && a.includes('projeção de custo_medio'))).toBe(true)
    // A nota FOI lançada: um erro suave do estoque não é motivo para recusar.
    const notas = await w.store.query(E.notas, [], 500)
    expect(notas[0].data.status).toBe('lancada')
  })

  // --- FINDING 7: valor_total é o total do DOCUMENTO, independente da política de custo.
  it('valor_total é o total do DOCUMENTO mesmo com incluir_frete: false', async () => {
    const w = testWorld()
    w.store.seedRecord(E.politica, {
      id: 'POL', version: 1,
      data: { incluir_frete: false, incluir_impostos: true, incluir_descontos: true, criterio_rateio_frete: 'valor' },
    })
    const { nota } = svc(w)
    const r = await nota.execute({
      ...notaBase, valorFrete: 50,
      itens: [{ insumoId: 'TECIDO', qtd: 10, precoUnitario: 10 }],   // 100 de produtos
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    // Documento: 100 (produtos) − 0 (desconto) + 50 (frete, sempre no documento) + 0 (imposto) = 150.
    // O CUSTEADO (o que o estoque recebeu) é 100: o frete ficou fora por política.
    expect(r.value.valorTotal).toBeCloseTo(150, 10)
    const notas = await w.store.query(E.notas, [], 500)
    expect(notas[0].data.valor_total).toBeCloseTo(150, 10)
  })

  // --- FINDING 5: falha na fase pós-movimento (status/pedido) não desfaz a operação: os
  // movimentos JÁ ENTRARAM, então é sucesso com um aviso ALTO, nunca uma exceção crua nem um
  // `ok()` silencioso que esconde a nota presa em rascunho.
  it('conflito de versão ao finalizar a nota (depois dos movimentos) NÃO desfaz a operação: vira aviso, nota fica em rascunho', async () => {
    const w = testWorld()
    let notaId: string | null = null
    const storeComFalha: RecordStore = {
      query: (entityId, where, limit) => w.store.query(entityId, where, limit),
      get: (recordId) => w.store.get(recordId),
      insert: async (entityId, data) => {
        const id = await w.store.insert(entityId, data)
        if (data.status === 'rascunho') notaId = id   // só a nota nasce em 'rascunho'
        return id
      },
      update: async (recordId, data, expectedVersion) => {
        if (recordId === notaId && data.status === 'lancada') {
          notaId = null   // falha só na primeira tentativa
          throw new Error('conflito de versão simulado')
        }
        return w.store.update(recordId, data, expectedVersion)
      },
      delete: (recordId) => w.store.delete(recordId),
    }
    const estoque = new FakeEstoqueMovimentos({ depositosConhecidos: w.depositosConhecidos, produtos: w.produtos })
    const nota = new LancarNotaEntradaService(storeComFalha, w.store, estoque)
    const r = await nota.execute({ ...notaBase, itens: [{ insumoId: 'TECIDO', qtd: 10, precoUnitario: 10 }] })

    // A operação SUCEDEU: o movimento já entrou no estoque, o custo já pesou.
    expect(r.ok).toBe(true)
    expect(estoque.recebidos).toHaveLength(1)
    expect(r.ok && r.value.avisos.some((a) => a.includes('RASCUNHO') && a.includes('NÃO a lance de novo'))).toBe(true)

    const notas = await w.store.query(E.notas, [], 500)
    expect(notas[0].data.status).toBe('rascunho')   // não conseguiu virar 'lancada'
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

// O fake, sozinho, tem que recusar o que o RegistrarMovimentoService REAL recusaria — não só
// quando chamado através do LancarNotaEntradaService. Prova que a guarda existe no lugar certo
// (o ACL), não só "por acaso" porque o compras já filtrou antes.
describe('FakeEstoqueMovimentos', () => {
  it('recusa um depositoId que não está entre os conhecidos, do mesmo jeito que o estoque real', async () => {
    const estoque = new FakeEstoqueMovimentos({
      depositosConhecidos: ['DEP1'],
      produtos: new Map([['TECIDO', { controlaEstoque: true }]]),
    })
    await expect(estoque.registrarEntrada({
      insumoId: 'TECIDO', depositoId: 'DEP_FANTASMA', qtd: 10, custoUnitario: 10,
      origemTipo: 'nota_entrada', origemId: 'N1',
    })).rejects.toThrow(/depósito/)
  })

  it('recusa um insumo sem controla_estoque, do mesmo jeito que o estoque real', async () => {
    const estoque = new FakeEstoqueMovimentos({
      depositosConhecidos: ['DEP1'],
      produtos: new Map([['BOTAO', { controlaEstoque: false }]]),
    })
    await expect(estoque.registrarEntrada({
      insumoId: 'BOTAO', depositoId: 'DEP1', qtd: 10, custoUnitario: 1,
      origemTipo: 'nota_entrada', origemId: 'N1',
    })).rejects.toThrow(/controla estoque/)
  })

  it('recusa qtd <= 0, do mesmo jeito que o estoque real', async () => {
    const estoque = new FakeEstoqueMovimentos({ depositosConhecidos: ['DEP1'] })
    await expect(estoque.registrarEntrada({
      insumoId: 'TECIDO', depositoId: 'DEP1', qtd: 0, custoUnitario: 10,
      origemTipo: 'nota_entrada', origemId: 'N1',
    })).rejects.toThrow(/qtd/)
  })
})
