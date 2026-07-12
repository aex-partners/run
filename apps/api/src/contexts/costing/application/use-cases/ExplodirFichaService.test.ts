import { describe, it, expect } from 'vitest'
import { ExplodirFichaService } from '@/contexts/costing/application/use-cases/ExplodirFichaService'
import { RoteiroPublicadoView } from '@/contexts/costing/application/ports/out/RoteiroProvider'
import { seedWorld } from '../../adapters/out/fake/testWorld'
import { FakeRoteiroProvider, ROTEIRO_M1 } from '../../adapters/out/fake/FakeRoteiroProvider'

const roteiroM1 = () => new FakeRoteiroProvider({ M1: ROTEIRO_M1 })

describe('ExplodirFichaService', () => {
  it('explodes the SKU, writes exploded lines + snapshot, updates preco_custo', async () => {
    const s = seedWorld()
    const svc = new ExplodirFichaService(s, s, roteiroM1())
    const r = await svc.execute({ skuId: 'SKU' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.custoMateriais).toBeCloseTo(1.4 * 20 + 2 * 0.3, 6)
    expect(r.value.erros).toEqual([])
    // exploded lines written
    const exploded = await s.query('FICHAS_EXPLODIDAS', [{ field: 'sku', op: 'eq', value: 'SKU' }])
    expect(exploded.length).toBe(2)
    // snapshot written
    expect((await s.query('SNAPSHOTS_CUSTO', [{ field: 'sku', op: 'eq', value: 'SKU' }])).length).toBe(1)
    // preco_custo updated on the SKU
    expect((await s.get('SKU'))?.data.preco_custo).toBeCloseTo(28.6, 6)
  })

  it('fails when the modelo has no published ficha', async () => {
    const s = seedWorld()
    // demote both lines to rascunho
    await s.update('f1', { modelo: 'M1', item: 'PH', unidade: 'm2', qty_base: 1.4, qty_por_tamanho: '{"T38":1.4}', rev: 1, status: 'rascunho' }, 1)
    await s.update('f2', { modelo: 'M1', item: 'BTN', unidade: 'un', qty_base: 2, qty_por_tamanho: '{}', rev: 1, status: 'rascunho' }, 1)
    const svc = new ExplodirFichaService(s, s, roteiroM1())
    const r = await svc.execute({ skuId: 'SKU' })
    expect(r.ok).toBe(false)
  })

  it('preserves editado_manual lines on re-explosion (override, no double-count); forcar overrides', async () => {
    const s = seedWorld()
    const svc = new ExplodirFichaService(s, s, roteiroM1())
    await svc.execute({ skuId: 'SKU' })                       // first explosion -> 2 lines (SARJA 28, BTN 0.6)
    // mark the SARJA line as manual with a DISTINCT cost of 50. Selecionada pelo ITEM, nunca pela
    // posição: o store devolve as linhas em created_at DESC, então indexar por posição amarraria o
    // teste à ordem de gravação (e a asserção de 50,6 abaixo só faz sentido se a manual for SARJA).
    const exploded = await s.query('FICHAS_EXPLODIDAS', [{ field: 'sku', op: 'eq', value: 'SKU' }], 500)
    const sarja = exploded.find((l) => l.data.item === 'SARJA')!
    await s.update(sarja.id, { ...sarja.data, editado_manual: true, qty: 99, custo_total: 50 }, sarja.version)

    const r2 = await svc.execute({ skuId: 'SKU' })            // re-explode, manual SARJA overrides fresh SARJA
    expect(r2.ok).toBe(true)
    if (!r2.ok) return
    expect(r2.value.manuaisPreservados).toBe(1)
    const kept = await s.query('FICHAS_EXPLODIDAS', [{ field: 'sku', op: 'eq', value: 'SKU' }])
    // manual SARJA survives untouched (distinct cost 50)
    expect(kept.some((l) => l.data.editado_manual === true && l.data.qty === 99 && l.data.custo_total === 50)).toBe(true)
    // fresh SARJA is NOT re-inserted: 1 manual SARJA (override) + 1 fresh BTN = 2 rows
    expect(kept.length).toBe(2)
    // total cost = 50 (manual SARJA) + 0.6 (fresh BTN), no double-count of SARJA
    expect((await s.get('SKU'))?.data.preco_custo).toBeCloseTo(50.6, 6)

    const r3 = await svc.execute({ skuId: 'SKU', forcar: true })  // overwrite manual too
    if (!r3.ok) return
    expect(r3.value.manuaisPreservados).toBe(0)
    expect((await s.query('FICHAS_EXPLODIDAS', [{ field: 'sku', op: 'eq', value: 'SKU' }])).length).toBe(2)
    // fresh recompute only: SARJA 28 + BTN 0.6
    expect((await s.get('SKU'))?.data.preco_custo).toBeCloseTo(28.6, 6)
  })

  it('reports a Produtos write failure without aborting (cost still snapshotted)', async () => {
    const base = seedWorld()
    // Wrapper store: delegate everything to `base`, but make the SKU's preco_custo update throw
    // (simulates the data-layer full-record re-validation rejecting a stale/invalid Produtos field).
    const store = {
      query: base.query.bind(base),
      get: base.get.bind(base),
      insert: base.insert.bind(base),
      delete: base.delete.bind(base),
      entityIdBySlug: base.entityIdBySlug.bind(base),
      update: async (id: string, data: Record<string, unknown>, ver: number) => {
        if (id === 'SKU') throw new Error('unknown field "x"')
        return base.update(id, data, ver)
      },
    }
    const svc = new ExplodirFichaService(store as never, store as never, roteiroM1())
    const r = await svc.execute({ skuId: 'SKU' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.erros.some((e) => e.includes('não salvo em Produtos'))).toBe(true)
    // exploded lines + snapshot still persisted despite the Produtos write failing
    expect((await base.query('FICHAS_EXPLODIDAS', [{ field: 'sku', op: 'eq', value: 'SKU' }])).length).toBeGreaterThan(0)
    expect((await base.query('SNAPSHOTS_CUSTO', [{ field: 'sku', op: 'eq', value: 'SKU' }])).length).toBe(1)
  })

  it('computes the FULL cost: materials + MOD + indirect, and writes the breakdown', async () => {
    const s = seedWorld()
    const svc = new ExplodirFichaService(s, s, roteiroM1())
    const r = await svc.execute({ skuId: 'SKU' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.erros).toEqual([])
    expect(r.value.custoMateriais).toBeCloseTo(28.6, 6)
    expect(r.value.custoMod).toBeCloseTo(10, 6)          // 10 min × R$ 1,00
    expect(r.value.custoIndireto).toBeCloseTo(5, 6)      // 10 min × R$ 0,50
    expect(r.value.custoTotal).toBeCloseTo(43.6, 6)      // 28,6 + 15
    expect(r.value.tempoTotalMin).toBeCloseTo(10, 6)

    const sku = await s.get('SKU')
    expect(sku?.data.preco_custo).toBeCloseTo(28.6, 6)             // materiais (semântica Bling)
    expect(sku?.data.custo_conversao).toBeCloseTo(15, 6)
    expect(sku?.data.custo_unitario_total).toBeCloseTo(43.6, 6)
    expect(sku?.data.tempo_total_min).toBeCloseTo(10, 6)

    const [snap] = await s.query('SNAPSHOTS_CUSTO', [{ field: 'sku', op: 'eq', value: 'SKU' }])
    expect(snap.data.custo_total).toBeCloseTo(43.6, 6)              // snapshot = custo CHEIO
    expect(snap.data.custo_materiais).toBeCloseTo(28.6, 6)
    expect(snap.data.origem_rev_roteiro).toBe(1)
    // o histórico se explica por si: as taxas usadas ficam DENTRO do payload do snapshot
    const detalhe = JSON.parse(String(snap.data.detalhe_conversao))
    expect(detalhe.taxas).toEqual([{ chave: 'taxa_fixa_min', centroId: null, valor: 0.5 }])
    expect(detalhe.operacoes).toHaveLength(1)

    const ops = await s.query('CUSTOS_OP', [{ field: 'sku', op: 'eq', value: 'SKU' }])
    expect(ops.length).toBe(1)
    expect(ops[0].data.custo_total).toBeCloseTo(15, 6)
  })

  it('modelo sem roteiro publicado: materiais-only + erro, ainda ok', async () => {
    const s = seedWorld()
    const svc = new ExplodirFichaService(s, s, new FakeRoteiroProvider({}))   // nenhum roteiro
    const r = await svc.execute({ skuId: 'SKU' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.custoTotal).toBeCloseTo(28.6, 6)                 // só materiais
    expect(r.value.custoMod).toBe(0)
    expect(r.value.erros.some((e) => e.includes('sem roteiro publicado'))).toBe(true)
    expect((await s.get('SKU'))?.data.custo_unitario_total).toBeCloseTo(28.6, 6)
  })

  it('re-explodir substitui as linhas de custos_de_operacao do SKU (não acumula)', async () => {
    const s = seedWorld()
    const svc = new ExplodirFichaService(s, s, roteiroM1())
    await svc.execute({ skuId: 'SKU' })
    await svc.execute({ skuId: 'SKU' })
    expect((await s.query('CUSTOS_OP', [{ field: 'sku', op: 'eq', value: 'SKU' }], 500)).length).toBe(1)
  })

  // REGRESSÃO (dinheiro errado em silêncio): o query engine devolve no máximo
  // `Math.min(limit ?? 50, 500)` linhas, ORDER BY created_at DESC. parametros_de_custo é uma
  // entidade HISTÓRICA por design (cada mudança de taxa vira uma linha nova), e a taxa global de
  // vigência ABERTA é justamente a MAIS ANTIGA. Sem limite explícito, passar de 50 linhas descarta
  // as mais velhas, `taxasVigentes` não acha a taxa, `pickTaxa` cai para 0 e o CUSTO INDIRETO
  // VIRA ZERO sem erro nenhum.
  it('acha a taxa antiga de vigência aberta com >50 parâmetros de custo (senão o indireto zera em silêncio)', async () => {
    const s = seedWorld()
    // seedWorld já semeou tx1 (taxa_fixa_min 0,5/min, global, 2020-01-01 -> aberta) como a linha
    // MAIS ANTIGA de PARAMETROS. Agora 59 linhas expiradas/irrelevantes DEPOIS dela (60 no total).
    for (let i = 0; i < 59; i++) {
      s.seedRecord('PARAMETROS', { id: `px${i}`, version: 1, data: {
        chave: 'taxa_moi_min', escopo_centro: `C_OUTRO_${i}`, valor: 99,
        vigencia_inicio: '2019-01-01', vigencia_fim: '2019-12-31',    // expirada: nunca vigente hoje
      } })
    }

    const svc = new ExplodirFichaService(s, s, roteiroM1())
    const r = await svc.execute({ skuId: 'SKU' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.custoIndireto).toBeCloseTo(5, 6)      // 10 min × 0,5: a taxa VELHA foi encontrada
    expect(r.value.custoTotal).toBeCloseTo(43.6, 6)      // 28,6 materiais + 10 MOD + 5 indireto
    expect(r.value.erros).toEqual([])

    const snaps = await s.query('SNAPSHOTS_CUSTO', [{ field: 'sku', op: 'eq', value: 'SKU' }], 500)
    const detalhe = JSON.parse(String(snaps[0]?.data.detalhe_conversao))
    expect(detalhe.taxas).toEqual([{ chave: 'taxa_fixa_min', centroId: null, valor: 0.5 }])
  })

  // O ELO HEADLINE DA FEATURE: "onde cada insumo é consumido". A linha da ficha aponta para o
  // CÓDIGO ESTÁVEL da operação (operacao_codigo), não para a linha da revisão — que morreria na
  // próxima revisão publicada do roteiro. O código tem de atravessar a explosão até a linha
  // explodida, alinhado com o insumo CERTO (o alinhamento é POSICIONAL entre `lines` e
  // `result.lines`: um índice trocado atribuiria o insumo à operação errada, calado).
  it('carrega o operacao_codigo da linha da ficha para a linha explodida (e preserva o não-atribuído)', async () => {
    const s = seedWorld()
    // testWorld: f1 (PH -> SARJA por substituição) é atribuída a COSTURA; f2 (BTN) não tem atribuição.
    const r = await new ExplodirFichaService(s, s, roteiroM1()).execute({ skuId: 'SKU' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.erros).toEqual([])                    // COSTURA existe no roteiro: nada pendurado

    const exploded = await s.query('FICHAS_EXPLODIDAS', [{ field: 'sku', op: 'eq', value: 'SKU' }], 500)
    expect(exploded).toHaveLength(2)

    // o insumo resolvido (SARJA, que veio do fantasma PH da linha f1) leva o código de f1
    const sarja = exploded.find((l) => l.data.item === 'SARJA')!
    expect(sarja.data.operacao_codigo).toBe('COSTURA')
    // e o botão, cuja linha não foi atribuída, continua sem operação
    const btn = exploded.find((l) => l.data.item === 'BTN')!
    expect(btn.data.operacao_codigo).toBeNull()

    // a linha CUSTEADA guarda a relação com a linha da revisão E o código, para leitura humana
    const ops = await s.query('CUSTOS_OP', [{ field: 'sku', op: 'eq', value: 'SKU' }], 500)
    expect(ops).toHaveLength(1)
    expect(ops[0]!.data.operacao).toBe('OP1')            // a linha DAQUELA revisão
    expect(ops[0]!.data.codigo).toBe('COSTURA')          // a identidade estável
  })

  // ATRIBUIÇÃO PENDURADA: código digitado errado, ou operação que sumiu numa revisão nova do
  // roteiro. O material é real e continua custeado — mas o "onde é consumido" está quebrado e o
  // engenheiro precisa saber. SOFT: reporta em `erros`, NUNCA derruba a explosão.
  it('reporta (soft) a linha de ficha atribuída a um código que não existe no roteiro publicado', async () => {
    const s = seedWorld()
    // f2 (BTN) aponta para uma operação que o roteiro do M1 não tem
    await s.update('f2', {
      modelo: 'M1', item: 'BTN', unidade: 'un', qty_base: 2, qty_por_tamanho: '{}',
      rev: 1, status: 'publicada', operacao_codigo: 'BORDADO',
    }, 1)

    const r = await new ExplodirFichaService(s, s, roteiroM1()).execute({ skuId: 'SKU' })
    expect(r.ok).toBe(true)                              // SOFT: a explosão NÃO cai
    if (!r.ok) return
    expect(r.value.erros.some((e) => e.includes('BORDADO'))).toBe(true)
    expect(r.value.erros.some((e) => e.includes('não existe no roteiro publicado'))).toBe(true)
    // COSTURA (a atribuição boa de f1) NÃO é reportada
    expect(r.value.erros.some((e) => e.includes('COSTURA'))).toBe(false)

    // o custo segue completo e correto: materiais + conversão, nada perdido
    expect(r.value.custoMateriais).toBeCloseTo(28.6, 6)
    expect(r.value.custoTotal).toBeCloseTo(43.6, 6)
    // e a atribuição pendurada é PRESERVADA na linha explodida (é o que o engenheiro vai corrigir)
    const exploded = await s.query('FICHAS_EXPLODIDAS', [{ field: 'sku', op: 'eq', value: 'SKU' }], 500)
    expect(exploded.find((l) => l.data.item === 'BTN')!.data.operacao_codigo).toBe('BORDADO')
  })

  // Regra NÃO NEGOCIÁVEL de soft failure, fixada na camada de integração: operação sem centro
  // não derruba a explosão, mas o erro TEM de chegar ao chamador.
  it('operação sem centro: ok, tempo ainda conta, MOD 0 e o erro CHEGA em ExplosaoResumo.erros', async () => {
    const s = seedWorld()
    const semCentro: RoteiroPublicadoView = {
      modeloId: 'M1',
      rev: 1,
      operacoes: [
        { id: 'OP1', codigo: 'COSTURA', seq: 10, centroId: null, tempoPadraoMin: 10, tempoPorTamanho: {}, tempoSetupMin: 0, loteSetup: 1 },
      ],
      centros: [],
    }
    const svc = new ExplodirFichaService(s, s, new FakeRoteiroProvider({ M1: semCentro }))
    const r = await svc.execute({ skuId: 'SKU' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.custoMod).toBe(0)                          // sem centro: nenhum custo de MOD
    expect(r.value.tempoTotalMin).toBeCloseTo(10, 6)          // o tempo AINDA é contabilizado
    expect(r.value.custoIndireto).toBeCloseTo(5, 6)           // taxa global incide sobre o tempo
    expect(r.value.custoTotal).toBeCloseTo(33.6, 6)           // 28,6 + 0 + 5
    expect(r.value.erros.some((e) => e.includes('sem centro de trabalho'))).toBe(true)

    const ops = await s.query('CUSTOS_OP', [{ field: 'sku', op: 'eq', value: 'SKU' }], 500)
    expect(ops[0]?.data.custo_mod).toBe(0)
    expect(ops[0]?.data.tempo_min).toBeCloseTo(10, 6)
  })
})
