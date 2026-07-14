import { describe, it, expect } from 'vitest'
import { testWorld, E } from '@/contexts/estoque/adapters/out/fake/testWorld'
import { RegistrarMovimentoService } from '@/contexts/estoque/application/use-cases/RegistrarMovimentoService'

const svc = (store: ReturnType<typeof testWorld>['store']) =>
  new RegistrarMovimentoService(store, store)

const produto = async (store: ReturnType<typeof testWorld>['store'], id: string) =>
  (await store.get(id))!.data

describe('RegistrarMovimentoService', () => {
  it('entrada de nota grava o movimento e pondera o custo médio em Produtos', async () => {
    const { store } = testWorld()
    const r = await svc(store).execute({
      insumoId: 'TECIDO', depositoId: 'DEP1', tipo: 'entrada_nota',
      qtd: 100, custoUnitario: 10, origemTipo: 'nota_entrada', origemId: 'N1',
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.saldoTotal).toBe(100)
    expect(r.value.custoMedio).toBe(10)
    expect(r.value.erros).toEqual([])

    const p = await produto(store, 'TECIDO')
    expect(p.saldo_total).toBe(100)
    expect(p.custo_medio).toBe(10)
    // ESPELHO: é o campo que o costing lê como custo de material na explosão.
    expect(p.preco_custo).toBe(10)
    expect(p.custo_medio_atualizado_em).toBeTruthy()
  })

  it('a segunda entrada pondera: 100 a R$10 + 100 a R$20 = médio R$15', async () => {
    const { store } = testWorld()
    const s = svc(store)
    await s.execute({ insumoId: 'TECIDO', depositoId: 'DEP1', tipo: 'entrada_nota', qtd: 100, custoUnitario: 10 })
    const r = await s.execute({ insumoId: 'TECIDO', depositoId: 'DEP1', tipo: 'entrada_nota', qtd: 100, custoUnitario: 20 })
    expect(r.ok && r.value.custoMedio).toBeCloseTo(15, 10)
    expect(r.ok && r.value.saldoTotal).toBe(200)
  })

  it('o movimento grava o saldo e o custo médio RESULTANTES (o livro se explica sozinho)', async () => {
    const { store } = testWorld()
    const s = svc(store)
    await s.execute({ insumoId: 'TECIDO', depositoId: 'DEP1', tipo: 'entrada_nota', qtd: 100, custoUnitario: 10 })
    await s.execute({ insumoId: 'TECIDO', depositoId: 'DEP1', tipo: 'entrada_nota', qtd: 100, custoUnitario: 20 })

    const movs = await store.query(E.movimentos, [{ field: 'insumo', op: 'eq', value: 'TECIDO' }], 500)
    expect(movs).toHaveLength(2)
    // A query devolve NEWEST-FIRST (espelha o engine real): movs[0] é a segunda entrada.
    expect(movs[0].data.saldo_total_apos).toBe(200)
    expect(movs[0].data.custo_medio_apos).toBeCloseTo(15, 10)
    expect(movs[1].data.saldo_total_apos).toBe(100)
    expect(movs[1].data.custo_medio_apos).toBe(10)
  })

  // A REGRA CENTRAL.
  it('saída NÃO muda o custo médio, e sai ao médio vigente', async () => {
    const { store } = testWorld([{ id: 'TECIDO', saldoTotal: 100, custoMedio: 15 }])
    const r = await svc(store).execute({
      insumoId: 'TECIDO', depositoId: 'DEP1', tipo: 'saida_manual', qtd: -30,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.saldoTotal).toBe(70)
    expect(r.value.custoMedio).toBe(15)

    const movs = await store.query(E.movimentos, [{ field: 'insumo', op: 'eq', value: 'TECIDO' }], 500)
    // O custo do movimento é o médio pelo qual a quantidade SAIU.
    expect(movs[0].data.custo_unitario).toBe(15)
  })

  // Um `saida_manual` que trouxesse custoUnitario NÃO pode usá-lo: a saída sai ao custo médio
  // VIGENTE. Sem este teste, `cmd.custoUnitario ?? antes.custoMedio` passaria na suíte inteira.
  it('custoUnitario é IGNORADO num movimento que não custeia', async () => {
    const { store } = testWorld([{ id: 'TECIDO', saldoTotal: 100, custoMedio: 15 }])
    const r = await svc(store).execute({
      insumoId: 'TECIDO', depositoId: 'DEP1', tipo: 'saida_manual', qtd: -10, custoUnitario: 999,
    })
    expect(r.ok && r.value.custoMedio).toBe(15)
    const movs = await store.query(E.movimentos, [{ field: 'insumo', op: 'eq', value: 'TECIDO' }], 500)
    expect(movs[0].data.custo_unitario).toBe(15)   // o médio vigente, não os 999
  })

  it('ajuste, contagem e devolução também não mexem no custo médio', async () => {
    for (const tipo of ['ajuste', 'contagem', 'devolucao_fornecedor']) {
      const { store } = testWorld([{ id: 'TECIDO', saldoTotal: 100, custoMedio: 15 }])
      const r = await svc(store).execute({ insumoId: 'TECIDO', depositoId: 'DEP1', tipo, qtd: -10 })
      expect(r.ok && r.value.custoMedio).toBe(15)
    }
  })

  it('inventário de abertura semeia o custo médio', async () => {
    const { store } = testWorld()
    const r = await svc(store).execute({
      insumoId: 'TECIDO', depositoId: 'DEP1', tipo: 'inventario_abertura', qtd: 42, custoUnitario: 15,
    })
    expect(r.ok && r.value.custoMedio).toBe(15)
    expect(r.ok && r.value.saldoTotal).toBe(42)
  })

  // C1: `preco_custo` é o custo que o motor de ficha LÊ, e em produção ele já vem do ERP antigo.
  // Um movimento que não custeia (ajuste/contagem/saída) NÃO tem opinião de custo: espelhar o
  // custo médio 0 em cima de um custo real o DESTRUIRIA, e em silêncio (mudouCusto seria falso,
  // o carimbo não sairia, e o custos_desatualizados nem avisaria).
  it('movimento sem custo NÃO zera o preco_custo real de um insumo com livro vazio', async () => {
    const { store } = testWorld([{ id: 'SARJA', precoCusto: 25, custoMedio: 0, saldoTotal: 0 }])
    const r = await svc(store).execute({
      insumoId: 'SARJA', depositoId: 'DEP1', tipo: 'ajuste', qtd: 50,
    })
    expect(r.ok).toBe(true)
    const p = (await store.get('SARJA'))!.data
    expect(p.preco_custo).toBe(25)     // INTACTO
    expect(p.saldo_total).toBe(50)     // a quantidade entrou
    expect(p.custo_medio).toBe(0)      // o estoque ainda não tem custo
  })

  it('a PRIMEIRA entrada com custo assume o preco_custo', async () => {
    const { store } = testWorld([{ id: 'SARJA', precoCusto: 25, custoMedio: 0, saldoTotal: 0 }])
    await svc(store).execute({
      insumoId: 'SARJA', depositoId: 'DEP1', tipo: 'inventario_abertura', qtd: 10, custoUnitario: 30,
    })
    const p = (await store.get('SARJA'))!.data
    expect(p.custo_medio).toBe(30)
    expect(p.preco_custo).toBe(30)     // AGORA sim: o estoque tem uma opinião de custo
    expect(p.custo_medio_atualizado_em).toBeTruthy()
  })

  // Uma saída NÃO pode carimbar custo_medio_atualizado_em: se carimbasse, todo SKU
  // apareceria como "custo defasado" a cada baixa, e o aviso viraria ruído.
  it('movimento que não custeia NÃO carimba custo_medio_atualizado_em', async () => {
    const { store } = testWorld([{ id: 'TECIDO', saldoTotal: 100, custoMedio: 15 }])
    await svc(store).execute({ insumoId: 'TECIDO', depositoId: 'DEP1', tipo: 'saida_manual', qtd: -10 })
    const p = await produto(store, 'TECIDO')
    expect(p.custo_medio_atualizado_em).toBeUndefined()
    expect(p.saldo_total).toBe(90)
  })

  it('entrada que NÃO altera o valor do médio também não recarimba', async () => {
    const { store } = testWorld([{ id: 'TECIDO', saldoTotal: 100, custoMedio: 10 }])
    const s = svc(store)
    // Entrada exatamente ao mesmo custo: o médio continua 10.
    await s.execute({ insumoId: 'TECIDO', depositoId: 'DEP1', tipo: 'entrada_nota', qtd: 50, custoUnitario: 10 })
    const p = await produto(store, 'TECIDO')
    expect(p.custo_medio).toBe(10)
    expect(p.custo_medio_atualizado_em).toBeUndefined()
    expect(p.saldo_total).toBe(150)
  })

  it('mantém saldo por depósito, e o custo médio é GLOBAL', async () => {
    const { store } = testWorld()
    const s = svc(store)
    await s.execute({ insumoId: 'TECIDO', depositoId: 'DEP1', tipo: 'entrada_nota', qtd: 100, custoUnitario: 10 })
    const r = await s.execute({ insumoId: 'TECIDO', depositoId: 'DEP2', tipo: 'entrada_nota', qtd: 100, custoUnitario: 20 })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.saldoDeposito).toBe(100)   // só DEP2
    expect(r.value.saldoTotal).toBe(200)      // os dois
    expect(r.value.custoMedio).toBeCloseTo(15, 10)  // ponderado GLOBALMENTE

    const saldos = await store.query(E.saldos, [{ field: 'insumo', op: 'eq', value: 'TECIDO' }], 500)
    expect(saldos).toHaveLength(2)
    expect(saldos.map((s) => s.data.qtd).sort()).toEqual([100, 100])
  })

  it('movimentos no mesmo depósito acumulam numa linha só de saldo', async () => {
    const { store } = testWorld()
    const s = svc(store)
    await s.execute({ insumoId: 'TECIDO', depositoId: 'DEP1', tipo: 'entrada_nota', qtd: 100, custoUnitario: 10 })
    await s.execute({ insumoId: 'TECIDO', depositoId: 'DEP1', tipo: 'saida_manual', qtd: -30 })
    const saldos = await store.query(E.saldos, [{ field: 'insumo', op: 'eq', value: 'TECIDO' }], 500)
    expect(saldos).toHaveLength(1)
    expect(saldos[0].data.qtd).toBe(70)
  })

  // SOFT: grava o movimento, deixa o saldo negativo, e AVISA. Bloquear travaria a
  // fábrica; esconder mentiria.
  it('saída maior que o saldo grava, deixa negativo, e devolve erro suave', async () => {
    const { store } = testWorld([{ id: 'TECIDO', saldoTotal: 10, custoMedio: 15 }])
    const r = await svc(store).execute({
      insumoId: 'TECIDO', depositoId: 'DEP1', tipo: 'saida_manual', qtd: -30,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.saldoTotal).toBe(-20)
    expect(r.value.erros).toHaveLength(1)
    expect(r.value.erros[0]).toContain('NEGATIVO')

    const movs = await store.query(E.movimentos, [{ field: 'insumo', op: 'eq', value: 'TECIDO' }], 500)
    expect(movs).toHaveLength(1)   // gravou mesmo assim
  })

  // DUROS: recusam o movimento.
  it('entrada sem custoUnitario é recusada (zeraria o custo médio em silêncio)', async () => {
    const { store } = testWorld()
    const r = await svc(store).execute({
      insumoId: 'TECIDO', depositoId: 'DEP1', tipo: 'entrada_nota', qtd: 100,
    })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toContain('custoUnitario')
    expect(await store.query(E.movimentos, [], 500)).toHaveLength(0)
  })

  // A FALHA EXATA que esta guarda existe para impedir: custo zero zera o custo médio E não
  // carimba custo_medio_atualizado_em (0 !== 0 é falso), então nem o aviso de defasagem pega.
  it('entrada com custoUnitario ZERO é recusada, e nada é gravado', async () => {
    const { store } = testWorld()
    const r = await svc(store).execute({
      insumoId: 'TECIDO', depositoId: 'DEP1', tipo: 'entrada_nota', qtd: 100, custoUnitario: 0,
    })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toContain('maior que zero')
    expect(await store.query(E.movimentos, [], 500)).toHaveLength(0)
    const p = await produto(store, 'TECIDO')
    expect(p.custo_medio).toBe(0)      // intacto: era 0 e continua 0, mas NADA foi gravado
    expect(p.saldo_total).toBe(0)
  })

  it('entrada com custoUnitario NEGATIVO é recusada', async () => {
    const { store } = testWorld()
    const r = await svc(store).execute({
      insumoId: 'TECIDO', depositoId: 'DEP1', tipo: 'entrada_nota', qtd: 100, custoUnitario: -5,
    })
    expect(r.ok).toBe(false)
    expect(await store.query(E.movimentos, [], 500)).toHaveLength(0)
  })

  it('inventário de abertura a custo zero é recusado pelo mesmo motivo', async () => {
    const { store } = testWorld()
    const r = await svc(store).execute({
      insumoId: 'TECIDO', depositoId: 'DEP1', tipo: 'inventario_abertura', qtd: 42, custoUnitario: 0,
    })
    expect(r.ok).toBe(false)
    expect(await store.query(E.movimentos, [], 500)).toHaveLength(0)
  })

  it('entrada com quantidade negativa é recusada', async () => {
    const { store } = testWorld()
    const r = await svc(store).execute({
      insumoId: 'TECIDO', depositoId: 'DEP1', tipo: 'entrada_nota', qtd: -5, custoUnitario: 10,
    })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toContain('positiva')
  })

  it('quantidade zero é recusada', async () => {
    const { store } = testWorld()
    const r = await svc(store).execute({
      insumoId: 'TECIDO', depositoId: 'DEP1', tipo: 'ajuste', qtd: 0,
    })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toContain('zero')
  })

  it('tipo inválido é recusado, listando os válidos', async () => {
    const { store } = testWorld()
    const r = await svc(store).execute({
      insumoId: 'TECIDO', depositoId: 'DEP1', tipo: 'inventado', qtd: 10,
    })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toContain('inventado')
    expect(!r.ok && r.error).toContain('entrada_nota')
  })

  it('produto sem controla_estoque é recusado', async () => {
    const { store } = testWorld([{ id: 'BOTAO', controlaEstoque: false }])
    const r = await svc(store).execute({
      insumoId: 'BOTAO', depositoId: 'DEP1', tipo: 'ajuste', qtd: 10,
    })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toContain('controla_estoque')
  })

  it('insumo inexistente é recusado', async () => {
    const { store } = testWorld()
    const r = await svc(store).execute({
      insumoId: 'FANTASMA', depositoId: 'DEP1', tipo: 'ajuste', qtd: 10,
    })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toContain('insumo')
  })

  it('depósito inexistente é recusado', async () => {
    const { store } = testWorld()
    const r = await svc(store).execute({
      insumoId: 'TECIDO', depositoId: 'NAO_EXISTE', tipo: 'ajuste', qtd: 10,
    })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toContain('depósito')
  })

  it('um id que NÃO é de depósito é recusado (o livro é append-only: não dá para desfazer)', async () => {
    const { store } = testWorld()
    // 'TECIDO' é um produto, não um depósito.
    const r = await svc(store).execute({
      insumoId: 'TECIDO', depositoId: 'TECIDO', tipo: 'ajuste', qtd: 10,
    })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toContain('depósito')
    expect(await store.query(E.movimentos, [], 500)).toHaveLength(0)
  })

  // O livro é a verdade. Se a projeção falhar, o movimento CONTINUA válido: devolver falha
  // faria o chamador repetir e gravar o movimento DUAS vezes.
  it('falha de projeção NÃO derruba o movimento: erro suave, e o livro fica gravado', async () => {
    const { store } = testWorld()
    const original = store.update.bind(store)
    store.update = async () => {
      throw new Error('version conflict')
    }
    const r = await svc(store).execute({
      insumoId: 'TECIDO', depositoId: 'DEP1', tipo: 'entrada_nota', qtd: 100, custoUnitario: 10,
    })
    store.update = original
    expect(r.ok).toBe(true)                                   // o movimento vale
    if (!r.ok) return
    expect(r.value.erros.some((e) => e.includes('replay'))).toBe(true)
    expect(await store.query(E.movimentos, [], 500)).toHaveLength(1)   // o livro tem a linha
  })

  // A INVARIANTE QUE DÁ NOME À TASK: o LIVRO primeiro, as projeções depois. Se a projeção
  // falhar, o livro continua certo e o replay reconstrói. Na ordem inversa, um crash deixaria
  // a projeção ADIANTADA e sem a linha do livro que a explica, e isso é irreversível.
  it('grava o LIVRO antes das projeções', async () => {
    const { store } = testWorld()
    const ordem: string[] = []
    const insertOriginal = store.insert.bind(store)
    const updateOriginal = store.update.bind(store)
    store.insert = async (entityId: string, data: Record<string, unknown>) => {
      ordem.push(entityId === E.movimentos ? 'LIVRO' : entityId === E.saldos ? 'saldo' : entityId)
      return insertOriginal(entityId, data)
    }
    store.update = async (id: string, data: Record<string, unknown>, v: number) => {
      ordem.push(id === 'TECIDO' ? 'produto' : 'saldo')
      return updateOriginal(id, data, v)
    }
    await svc(store).execute({
      insumoId: 'TECIDO', depositoId: 'DEP1', tipo: 'entrada_nota', qtd: 100, custoUnitario: 10,
    })
    store.insert = insertOriginal
    store.update = updateOriginal
    expect(ordem[0]).toBe('LIVRO')                 // o livro SEMPRE primeiro
    expect(ordem.slice(1)).toContain('produto')    // as projeções depois
  })
})
