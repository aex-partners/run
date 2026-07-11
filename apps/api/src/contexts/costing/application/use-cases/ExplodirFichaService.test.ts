import { describe, it, expect } from 'vitest'
import { ExplodirFichaService } from '@/contexts/costing/application/use-cases/ExplodirFichaService'
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
    // mark the first exploded line (SARJA) as manual with a DISTINCT cost of 50
    const [first] = await s.query('FICHAS_EXPLODIDAS', [{ field: 'sku', op: 'eq', value: 'SKU' }])
    await s.update(first.id, { ...first.data, editado_manual: true, qty: 99, custo_total: 50 }, first.version)

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
    expect((await s.query('CUSTOS_OP', [{ field: 'sku', op: 'eq', value: 'SKU' }])).length).toBe(1)
  })
})
