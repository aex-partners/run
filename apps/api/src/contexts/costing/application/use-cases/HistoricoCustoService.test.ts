import { describe, it, expect } from 'vitest'
import { HistoricoCustoService } from '@/contexts/costing/application/use-cases/HistoricoCustoService'
import { seedWorld } from '../../adapters/out/fake/testWorld'

describe('HistoricoCustoService', () => {
  it('returns snapshots ordered ascending by data', async () => {
    const s = seedWorld()
    // insert out of order: march first, then january
    s.seedRecord('SNAPSHOTS_CUSTO', { id: 'snap-mar', version: 1, data: { sku: 'SKU', data: '2026-03-02', custo_total: 30, origem_rev: 2 } })
    s.seedRecord('SNAPSHOTS_CUSTO', { id: 'snap-jan', version: 1, data: { sku: 'SKU', data: '2026-01-10', custo_total: 20, origem_rev: 1 } })

    const svc = new HistoricoCustoService(s, s)
    const result = await svc.execute({ skuId: 'SKU' })

    expect(result.length).toBe(2)
    expect(result[0]).toEqual({ data: '2026-01-10', custoTotal: 20, origemRev: 1 })
    expect(result[1]).toEqual({ data: '2026-03-02', custoTotal: 30, origemRev: 2 })
  })

  it('returns an empty array when there are no snapshots for the sku', async () => {
    const s = seedWorld()
    const svc = new HistoricoCustoService(s, s)
    const result = await svc.execute({ skuId: 'DOES-NOT-EXIST' })
    expect(result).toEqual([])
  })
})
