import { describe, it, expect } from 'vitest'
import { ok } from '@/shared/kernel/Result'
import { ExplodirFicha, ExplodirFichaCommand, ExplosaoResumo } from '@/contexts/costing/application/ports/in/ExplodirFicha'
import { RecalcularCustoService } from '@/contexts/costing/application/use-cases/RecalcularCustoService'
import { seedWorld } from '../../adapters/out/fake/testWorld'

function stubExplodir() {
  const calls: string[] = []
  const explodir: ExplodirFicha = {
    async execute(cmd: ExplodirFichaCommand) {
      calls.push(cmd.skuId)
      const resumo: ExplosaoResumo = { skuId: cmd.skuId, custoTotal: 0, linhas: 0, erros: [], manuaisPreservados: 0 }
      return ok(resumo)
    },
  }
  return { explodir, calls }
}

describe('RecalcularCustoService', () => {
  it('modeloId path: explodes every SKU of the modelo', async () => {
    const s = seedWorld()
    // seedWorld already has SKU 'SKU' on modelo M1; add a second produto on the same modelo
    s.seedRecord('PRODUTOS', { id: 'SKU2', version: 1, data: { produto: 'BOMBACHA T40 CAQUI', modelo: 'M1' } })
    const { explodir, calls } = stubExplodir()

    const svc = new RecalcularCustoService(explodir, s, s)
    const r = await svc.execute({ modeloId: 'M1' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.recalculados).toBe(2)
    expect(calls.sort()).toEqual(['SKU', 'SKU2'])
  })

  it('skuId path: explodes just that one SKU', async () => {
    const s = seedWorld()
    const { explodir, calls } = stubExplodir()

    const svc = new RecalcularCustoService(explodir, s, s)
    const r = await svc.execute({ skuId: 'SKU' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.recalculados).toBe(1)
    expect(calls).toEqual(['SKU'])
  })

  it('fails when neither skuId nor modeloId is given', async () => {
    const s = seedWorld()
    const { explodir } = stubExplodir()
    const svc = new RecalcularCustoService(explodir, s, s)
    const r = await svc.execute({})
    expect(r.ok).toBe(false)
  })
})
