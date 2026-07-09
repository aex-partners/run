import { describe, it, expect } from 'vitest'
import { PublicarRevisaoService } from '@/contexts/costing/application/use-cases/PublicarRevisaoService'
import { seedWorld } from '../../adapters/out/fake/testWorld'

describe('PublicarRevisaoService', () => {
  it('publishes a rascunho line as rev = prevMax + 1', async () => {
    const s = seedWorld()
    // seedWorld already has f1/f2 as 'publicada' rev 1 for modelo M1; add a rascunho line
    s.seedRecord('FICHAS_TECNICAS', { id: 'f3', version: 1, data: { modelo: 'M1', item: 'BTN', unidade: 'un', qty_base: 3, qty_por_tamanho: '{}', status: 'rascunho' } })

    const svc = new PublicarRevisaoService(s, s)
    const r = await svc.execute({ modeloId: 'M1' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.rev).toBe(2)

    const rascunho = await s.get('f3')
    expect(rascunho?.data.status).toBe('publicada')
    expect(rascunho?.data.rev).toBe(2)
  })

  it('fails when there is no rascunho for the modelo', async () => {
    const s = seedWorld()
    const svc = new PublicarRevisaoService(s, s)
    const r = await svc.execute({ modeloId: 'M1' })
    expect(r.ok).toBe(false)
  })
})
