import { describe, it, expect } from 'vitest'
import { seedManufacturing } from '@/contexts/manufacturing/adapters/out/fake/testWorld'
import { DefinirOperacaoService } from '@/contexts/manufacturing/application/use-cases/DefinirOperacaoService'
import { PublicarRoteiroService } from '@/contexts/manufacturing/application/use-cases/PublicarRoteiroService'
import { ObterRoteiroService } from '@/contexts/manufacturing/application/use-cases/ObterRoteiroService'
import { AbrirRevisaoRoteiroService } from '@/contexts/manufacturing/application/use-cases/AbrirRevisaoRoteiroService'
import { DescartarRascunhoRoteiroService } from '@/contexts/manufacturing/application/use-cases/DescartarRascunhoRoteiroService'

describe('DescartarRascunhoRoteiro', () => {
  it('apaga só os rascunhos; a revisão publicada continua resolvendo via ObterRoteiro sem mudança', async () => {
    const s = seedManufacturing()
    const definir = new DefinirOperacaoService(s, s)
    const publicar = new PublicarRoteiroService(s, s)
    const obter = new ObterRoteiroService(s, s)

    await definir.execute({ modeloId: 'M1', codigo: 'CORTE', seq: 10, nome: 'CORTE', centroId: 'C1', tempoPadraoMin: 10 })
    await definir.execute({ modeloId: 'M1', codigo: 'COSTURA', seq: 20, nome: 'COSTURA', centroId: 'C1', tempoPadraoMin: 20 })
    expect((await publicar.execute({ modeloId: 'M1' })).ok).toBe(true)

    const antes = await obter.execute({ modeloId: 'M1' })
    expect(antes?.rev).toBe(1)
    expect(antes?.operacoes).toHaveLength(2)

    // abre revisão (clona as 2 pra rascunho) e adiciona uma operação NOVA ao rascunho
    expect((await new AbrirRevisaoRoteiroService(s, s).execute({ modeloId: 'M1' })).ok).toBe(true)
    await definir.execute({ modeloId: 'M1', codigo: 'ACABAMENTO', seq: 30, nome: 'ACABAMENTO', centroId: 'C1', tempoPadraoMin: 15 })

    const d = await new DescartarRascunhoRoteiroService(s, s).execute({ modeloId: 'M1' })
    expect(d.ok).toBe(true)
    if (!d.ok) return
    expect(d.value.descartadas).toBe(3)      // 2 clonados + 1 nova

    const rows = await s.query('OPERACOES', [{ field: 'modelo', op: 'eq', value: 'M1' }], 500)
    expect(rows.filter((r) => r.data.status === 'rascunho')).toHaveLength(0)
    expect(rows.filter((r) => r.data.status === 'publicada')).toHaveLength(2)   // intocada

    // o roteiro em vigor não mudou nadinha
    const depois = await obter.execute({ modeloId: 'M1' })
    expect(depois).toEqual(antes)

    // e não está mais travado: dá pra abrir revisão de novo, do zero
    const ab2 = await new AbrirRevisaoRoteiroService(s, s).execute({ modeloId: 'M1' })
    expect(ab2.ok).toBe(true)
    if (!ab2.ok) return
    expect(ab2.value.complementadas).toBe(2)
  })

  it('retorna descartadas: 0 quando não há rascunho (não é erro)', async () => {
    const s = seedManufacturing()
    const definir = new DefinirOperacaoService(s, s)
    await definir.execute({ modeloId: 'M1', codigo: 'CORTE', seq: 10, nome: 'CORTE', centroId: 'C1', tempoPadraoMin: 10 })
    expect((await new PublicarRoteiroService(s, s).execute({ modeloId: 'M1' })).ok).toBe(true)

    const d = await new DescartarRascunhoRoteiroService(s, s).execute({ modeloId: 'M1' })
    expect(d.ok).toBe(true)
    if (!d.ok) return
    expect(d.value.descartadas).toBe(0)
  })

  // O OUTRO destravamento: em vez de curar um rascunho PARCIAL com o top-up de
  // AbrirRevisaoRoteiro, o usuário pode preferir jogar tudo fora e recomeçar.
  it('destrava um rascunho PARCIAL descartando tudo; abrir_revisao_roteiro clona o conjunto inteiro de novo', async () => {
    const s = seedManufacturing()
    const definir = new DefinirOperacaoService(s, s)
    await definir.execute({ modeloId: 'M1', codigo: 'CORTE', seq: 10, nome: 'CORTE', centroId: 'C1', tempoPadraoMin: 10 })
    await definir.execute({ modeloId: 'M1', codigo: 'COSTURA', seq: 20, nome: 'COSTURA', centroId: 'C1', tempoPadraoMin: 20 })
    await definir.execute({ modeloId: 'M1', codigo: 'ACABAMENTO', seq: 30, nome: 'ACABAMENTO', centroId: 'C1', tempoPadraoMin: 15 })
    expect((await new PublicarRoteiroService(s, s).execute({ modeloId: 'M1' })).ok).toBe(true)

    // rascunho parcial (crash no meio do clone): só CORTE virou rascunho
    s.seedRecord('OPERACOES', { id: 'clone1', version: 1, data: {
      modelo: 'M1', codigo: 'CORTE', seq: 10, nome: 'CORTE', centro: 'C1', tempo_padrao_min: 10,
      tempo_por_tamanho: '{}', tempo_setup_min: 0, lote_setup: 1, agregada: true, rev: 0, status: 'rascunho' } })

    const d = await new DescartarRascunhoRoteiroService(s, s).execute({ modeloId: 'M1' })
    expect(d.ok).toBe(true)
    if (!d.ok) return
    expect(d.value.descartadas).toBe(1)

    const ab = await new AbrirRevisaoRoteiroService(s, s).execute({ modeloId: 'M1' })
    expect(ab.ok).toBe(true)
    if (!ab.ok) return
    expect(ab.value.complementadas).toBe(3)    // do zero: as 3 operações publicadas
  })
})
