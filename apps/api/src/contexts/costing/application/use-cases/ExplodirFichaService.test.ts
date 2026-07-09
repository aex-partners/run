import { describe, it, expect } from 'vitest'
import { ExplodirFichaService } from '@/contexts/costing/application/use-cases/ExplodirFichaService'
import { seedWorld } from '../../adapters/out/fake/testWorld'

describe('ExplodirFichaService', () => {
  it('explodes the SKU, writes exploded lines + snapshot, updates preco_custo', async () => {
    const s = seedWorld()
    const svc = new ExplodirFichaService(s, s)
    const r = await svc.execute({ skuId: 'SKU' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.custoTotal).toBeCloseTo(1.4 * 20 + 2 * 0.3, 6)
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
    const svc = new ExplodirFichaService(s, s)
    const r = await svc.execute({ skuId: 'SKU' })
    expect(r.ok).toBe(false)
  })

  it('preserves editado_manual lines on re-explosion, deletes the rest; forcar overrides', async () => {
    const s = seedWorld()
    const svc = new ExplodirFichaService(s, s)
    await svc.execute({ skuId: 'SKU' })                       // first explosion -> 2 lines
    // mark one exploded line as manual
    const [first] = await s.query('FICHAS_EXPLODIDAS', [{ field: 'sku', op: 'eq', value: 'SKU' }])
    await s.update(first.id, { ...first.data, editado_manual: true, qty: 99 }, first.version)

    const r2 = await svc.execute({ skuId: 'SKU' })            // re-explode, preserve manual
    expect(r2.ok).toBe(true)
    if (!r2.ok) return
    expect(r2.value.manuaisPreservados).toBe(1)
    const kept = await s.query('FICHAS_EXPLODIDAS', [{ field: 'sku', op: 'eq', value: 'SKU' }])
    expect(kept.some((l) => l.data.editado_manual === true && l.data.qty === 99)).toBe(true)
    // total lines = 1 preserved manual + 2 fresh
    expect(kept.length).toBe(3)

    const r3 = await svc.execute({ skuId: 'SKU', forcar: true })  // overwrite manual too
    if (!r3.ok) return
    expect(r3.value.manuaisPreservados).toBe(0)
    expect((await s.query('FICHAS_EXPLODIDAS', [{ field: 'sku', op: 'eq', value: 'SKU' }])).length).toBe(2)
  })
})
