import { describe, it, expect } from 'vitest'
import { seedManufacturing } from '@/contexts/manufacturing/adapters/out/fake/testWorld'
import { DefinirOperacaoService } from '@/contexts/manufacturing/application/use-cases/DefinirOperacaoService'
import { PublicarRoteiroService } from '@/contexts/manufacturing/application/use-cases/PublicarRoteiroService'
import { ObterRoteiroService } from '@/contexts/manufacturing/application/use-cases/ObterRoteiroService'

describe('PublicarRoteiro + ObterRoteiro', () => {
  it('publishes drafts as rev 1 and ObterRoteiro then returns them with the work center', async () => {
    const s = seedManufacturing()
    const definir = new DefinirOperacaoService(s, s)
    const publicar = new PublicarRoteiroService(s, s)
    const obter = new ObterRoteiroService(s, s)

    expect(await obter.execute({ modeloId: 'M1' })).toBeNull()      // nada publicado ainda

    await definir.execute({ modeloId: 'M1', seq: 10, nome: 'COSTURA', centroId: 'C1', tempoPadraoMin: 45.53, agregada: true })
    expect(await obter.execute({ modeloId: 'M1' })).toBeNull()      // rascunho não conta

    const p = await publicar.execute({ modeloId: 'M1' })
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.value.rev).toBe(1)

    const r = await obter.execute({ modeloId: 'M1' })
    expect(r?.rev).toBe(1)
    expect(r?.operacoes).toEqual([{ id: expect.any(String), seq: 10, centroId: 'C1',
      tempoPadraoMin: 45.53, tempoPorTamanho: {}, tempoSetupMin: 0, loteSetup: 1 }])
    expect(r?.centros).toEqual([{ id: 'C1', custoMinMod: 1 }])
  })

  it('a second publish bumps to rev 2 and ObterRoteiro serves only the new rev', async () => {
    const s = seedManufacturing()
    const definir = new DefinirOperacaoService(s, s)
    const publicar = new PublicarRoteiroService(s, s)
    const obter = new ObterRoteiroService(s, s)
    await definir.execute({ modeloId: 'M1', seq: 10, nome: 'COSTURA', centroId: 'C1', tempoPadraoMin: 45.53 })
    await publicar.execute({ modeloId: 'M1' })
    // refina: duas operações finas
    await definir.execute({ modeloId: 'M1', seq: 10, nome: 'PREPARA', centroId: 'C1', tempoPadraoMin: 15, agregada: false })
    await definir.execute({ modeloId: 'M1', seq: 20, nome: 'FECHA', centroId: 'C1', tempoPadraoMin: 30, agregada: false })
    const p2 = await publicar.execute({ modeloId: 'M1' })
    if (!p2.ok) return
    expect(p2.value.rev).toBe(2)
    const r = await obter.execute({ modeloId: 'M1' })
    expect(r?.rev).toBe(2)
    expect(r?.operacoes.map((o) => o.tempoPadraoMin)).toEqual([15, 30])
  })

  it('fails when there is no draft to publish', async () => {
    const s = seedManufacturing()
    const r = await new PublicarRoteiroService(s, s).execute({ modeloId: 'M1' })
    expect(r.ok).toBe(false)
  })

  // REGRESSÃO (roteiro errado em silêncio): o query engine devolve no máximo
  // `Math.min(limit ?? 50, 500)` linhas, ORDER BY created_at DESC. Um modelo com histórico de
  // revisões passa de 50 linhas em `operacoes` facilmente; sem limite explícito as linhas MAIS
  // VELHAS (justamente as da revisão publicada) somem e o roteiro volta curto ou vazio.
  it('modelo com >50 operações: ObterRoteiro ainda devolve TODAS as ops da revisão publicada', async () => {
    const s = seedManufacturing()
    const definir = new DefinirOperacaoService(s, s)
    const publicar = new PublicarRoteiroService(s, s)
    const obter = new ObterRoteiroService(s, s)

    // rev 1 publicada: 8 operações de 5 min (as linhas MAIS ANTIGAS de `operacoes`)
    for (let i = 1; i <= 8; i++) {
      await definir.execute({ modeloId: 'M1', seq: i * 10, nome: `OP${i}`, centroId: 'C1', tempoPadraoMin: 5 })
    }
    const p = await publicar.execute({ modeloId: 'M1' })
    expect(p.ok).toBe(true)

    // rev 2 em RASCUNHO: 45 operações novas => 53 linhas para o modelo. Truncando em 50 e
    // mantendo as mais NOVAS, 3 das 8 ops publicadas caem fora: o roteiro voltaria com 5 de 8.
    for (let i = 1; i <= 45; i++) {
      await definir.execute({ modeloId: 'M1', seq: 1000 + i, nome: `DRAFT${i}`, centroId: 'C1', tempoPadraoMin: 3 })
    }

    const r = await obter.execute({ modeloId: 'M1' })
    expect(r?.rev).toBe(1)                                              // rascunhos não contam
    expect(r?.operacoes).toHaveLength(8)                                // NENHUMA op publicada perdida
    expect(r?.operacoes.reduce((sum, o) => sum + o.tempoPadraoMin, 0)).toBeCloseTo(40, 6)
    expect(r?.centros).toEqual([{ id: 'C1', custoMinMod: 1 }])
  })
})
