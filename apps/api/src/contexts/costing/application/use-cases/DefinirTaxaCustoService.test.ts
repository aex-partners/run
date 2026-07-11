import { describe, it, expect } from 'vitest'
import { seedWorld } from '@/contexts/costing/adapters/out/fake/testWorld'
import { DefinirTaxaCustoService } from '@/contexts/costing/application/use-cases/DefinirTaxaCustoService'

describe('DefinirTaxaCusto', () => {
  it('records a rate with its validity window', async () => {
    const s = seedWorld()
    const r = await new DefinirTaxaCustoService(s, s).execute({
      chave: 'taxa_moi_min', valor: 0.0323, vigenciaInicio: '2026-07-01',
    })
    expect(r.ok).toBe(true)
    const rows = await s.query('PARAMETROS', [{ field: 'chave', op: 'eq', value: 'taxa_moi_min' }], 500)
    expect(rows[0].data.valor).toBe(0.0323)
    expect(rows[0].data.vigencia_fim).toBeNull()
  })
  it('rejects an unknown key', async () => {
    const s = seedWorld()
    const r = await new DefinirTaxaCustoService(s, s).execute({ chave: 'bogus', valor: 1, vigenciaInicio: '2026-01-01' })
    expect(r.ok).toBe(false)
  })
})
