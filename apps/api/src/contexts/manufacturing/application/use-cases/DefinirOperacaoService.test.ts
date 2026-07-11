import { describe, it, expect } from 'vitest'
import { seedManufacturing } from '@/contexts/manufacturing/adapters/out/fake/testWorld'
import { DefinirOperacaoService } from '@/contexts/manufacturing/application/use-cases/DefinirOperacaoService'
import { PublicarRoteiroService } from '@/contexts/manufacturing/application/use-cases/PublicarRoteiroService'
import { ObterRoteiroService } from '@/contexts/manufacturing/application/use-cases/ObterRoteiroService'

const opsDoModelo = (s: ReturnType<typeof seedManufacturing>) =>
  s.query('OPERACOES', [{ field: 'modelo', op: 'eq', value: 'M1' }])

describe('DefinirOperacao', () => {
  it('creates a draft with the documented defaults and stringifies tempo_por_tamanho', async () => {
    const s = seedManufacturing()
    const r = await new DefinirOperacaoService(s, s).execute({
      modeloId: 'M1', seq: 10, nome: 'COSTURA', centroId: 'C1', tempoPadraoMin: 45.53, tempoPorTamanho: { T36: 40 },
    })
    expect(r.ok).toBe(true)

    const rows = await opsDoModelo(s)
    expect(rows).toHaveLength(1)
    const d = rows[0]!.data
    expect(d.status).toBe('rascunho')
    expect(d.rev).toBe(0)
    expect(d.lote_setup).toBe(1)          // default
    expect(d.tempo_setup_min).toBe(0)     // default
    expect(d.agregada).toBe(true)         // default
    expect(d.tempo_por_tamanho).toBe('{"T36":40}')   // JSON STRING no storage, não objeto
  })

  it('update (id present) resets a published operation back to draft', async () => {
    const s = seedManufacturing()
    const definir = new DefinirOperacaoService(s, s)

    const criada = await definir.execute({ modeloId: 'M1', seq: 10, nome: 'COSTURA', centroId: 'C1', tempoPadraoMin: 45.53 })
    expect(criada.ok).toBe(true)
    if (!criada.ok) return
    const id = criada.value.id

    const p = await new PublicarRoteiroService(s, s).execute({ modeloId: 'M1' })
    expect(p.ok).toBe(true)
    const publicada = (await opsDoModelo(s))[0]!.data
    expect(publicada.status).toBe('publicada')
    expect(publicada.rev).toBe(1)

    const r = await definir.execute({ id, modeloId: 'M1', seq: 20, nome: 'FECHA', centroId: 'C1', tempoPadraoMin: 30 })
    expect(r.ok).toBe(true)

    const rows = await opsDoModelo(s)
    expect(rows).toHaveLength(1)
    const d = rows[0]!.data
    expect(d.seq).toBe(20)
    expect(d.nome).toBe('FECHA')
    expect(d.tempo_padrao_min).toBe(30)
    expect(d.status).toBe('rascunho')     // volta a rascunho
    expect(d.rev).toBe(0)                 // e perde a rev

    // nada publicado sobrou: o roteiro some até republicar
    expect(await new ObterRoteiroService(s, s).execute({ modeloId: 'M1' })).toBeNull()
  })

  it('fails when the given id does not exist', async () => {
    const s = seedManufacturing()
    const r = await new DefinirOperacaoService(s, s).execute({
      id: 'nao-existe', modeloId: 'M1', seq: 10, nome: 'X', centroId: 'C1', tempoPadraoMin: 1,
    })
    expect(r.ok).toBe(false)
  })
})
