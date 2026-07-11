import { describe, it, expect } from 'vitest'
import { seedWorld } from '@/contexts/costing/adapters/out/fake/testWorld'
import { CustoUnitarioService } from '@/contexts/costing/application/use-cases/CustoUnitarioService'

describe('CustoUnitario', () => {
  it('returns null when the SKU was never exploded', async () => {
    const s = seedWorld()
    expect(await new CustoUnitarioService(s, s).execute({ skuId: 'SKU' })).toBeNull()
  })
  it('returns the LATEST snapshot breakdown, reading stored values only', async () => {
    const s = seedWorld()
    s.seedRecord('SNAPSHOTS_CUSTO', { id: 's1', version: 1, data: {
      sku: 'SKU', data: '2026-01-10', custo_total: 40, custo_materiais: 28.6, custo_mod: 8,
      custo_indireto: 3.4, tempo_total_min: 10, origem_rev_roteiro: 1 } })
    s.seedRecord('SNAPSHOTS_CUSTO', { id: 's2', version: 1, data: {
      sku: 'SKU', data: '2026-03-02', custo_total: 43.6, custo_materiais: 28.6, custo_mod: 10,
      custo_indireto: 5, tempo_total_min: 10, origem_rev_roteiro: 2 } })
    const v = await new CustoUnitarioService(s, s).execute({ skuId: 'SKU' })
    expect(v?.custoTotal).toBe(43.6)
    expect(v?.origemRevRoteiro).toBe(2)
  })
})
