import { describe, it, expect } from 'vitest'
import { seedManufacturing } from '@/contexts/manufacturing/adapters/out/fake/testWorld'
import { DefinirCentroService } from '@/contexts/manufacturing/application/use-cases/DefinirCentroService'
import { ListarCentrosService } from '@/contexts/manufacturing/application/use-cases/ListarCentrosService'

describe('DefinirCentro / ListarCentros', () => {
  it('creates a work center and lists it', async () => {
    const s = seedManufacturing()
    const r = await new DefinirCentroService(s, s).execute({ nome: 'CORTE', setor: 'corte', custoMinMod: 0.2805 })
    expect(r.ok).toBe(true)
    const centros = await new ListarCentrosService(s, s).execute()
    expect(centros.map((c) => c.custoMinMod).sort()).toEqual([0.2805, 1])
  })
  it('updates an existing work center when an id is given', async () => {
    const s = seedManufacturing()
    await new DefinirCentroService(s, s).execute({ id: 'C1', nome: 'COSTURA', setor: 'costura', custoMinMod: 2 })
    const centros = await new ListarCentrosService(s, s).execute()
    expect(centros.find((c) => c.id === 'C1')?.custoMinMod).toBe(2)
  })
})
