import { describe, it, expect } from 'vitest'
import { seedManufacturing } from '@/contexts/manufacturing/adapters/out/fake/testWorld'
import { DefinirOperacaoService } from '@/contexts/manufacturing/application/use-cases/DefinirOperacaoService'
import { PublicarRoteiroService } from '@/contexts/manufacturing/application/use-cases/PublicarRoteiroService'
import { ObterRoteiroService } from '@/contexts/manufacturing/application/use-cases/ObterRoteiroService'

const opsDoModelo = (s: ReturnType<typeof seedManufacturing>) =>
  s.query('OPERACOES', [{ field: 'modelo', op: 'eq', value: 'M1' }], 500)

describe('DefinirOperacao', () => {
  it('creates a draft with the documented defaults and stringifies tempo_por_tamanho', async () => {
    const s = seedManufacturing()
    const r = await new DefinirOperacaoService(s, s).execute({
      modeloId: 'M1', codigo: 'COSTURA', seq: 10, nome: 'COSTURA', centroId: 'C1',
      tempoPadraoMin: 45.53, tempoPorTamanho: { T36: 40 },
    })
    expect(r.ok).toBe(true)

    const rows = await opsDoModelo(s)
    expect(rows).toHaveLength(1)
    const d = rows[0]!.data
    expect(d.codigo).toBe('COSTURA')      // identidade ESTÁVEL da operação no modelo
    expect(d.status).toBe('rascunho')
    expect(d.rev).toBe(0)
    expect(d.lote_setup).toBe(1)          // default
    expect(d.tempo_setup_min).toBe(0)     // default
    expect(d.agregada).toBe(true)         // default
    expect(d.tempo_por_tamanho).toBe('{"T36":40}')   // JSON STRING no storage, não objeto
  })

  it('updates a RASCUNHO in place (nothing published yet: the draft is still editable)', async () => {
    const s = seedManufacturing()
    const definir = new DefinirOperacaoService(s, s)

    const criada = await definir.execute({
      modeloId: 'M1', codigo: 'COSTURA', seq: 10, nome: 'COSTURA', centroId: 'C1', tempoPadraoMin: 45.53,
    })
    expect(criada.ok).toBe(true)
    if (!criada.ok) return

    const r = await definir.execute({
      id: criada.value.id, modeloId: 'M1', codigo: 'COSTURA', seq: 20, nome: 'FECHA',
      centroId: 'C1', tempoPadraoMin: 30,
    })
    expect(r.ok).toBe(true)

    const rows = await opsDoModelo(s)
    expect(rows).toHaveLength(1)          // atualizou a linha, não criou outra
    const d = rows[0]!.data
    expect(d.seq).toBe(20)
    expect(d.nome).toBe('FECHA')
    expect(d.tempo_padrao_min).toBe(30)
    expect(d.status).toBe('rascunho')
    expect(d.rev).toBe(0)
  })

  // A REGRA que fecha o buraco crítico. Sobrescrever a linha publicada a devolveria para
  // rascunho/rev 0 — e como o roteiro publicado é SÓ o conjunto da maior rev publicada, as
  // OUTRAS operações da revisão sumiriam do custo na hora (e para sempre, no publish seguinte).
  it('REJECTS editing a PUBLISHED operation and points at abrir_revisao_roteiro', async () => {
    const s = seedManufacturing()
    const definir = new DefinirOperacaoService(s, s)

    const criada = await definir.execute({
      modeloId: 'M1', codigo: 'COSTURA', seq: 10, nome: 'COSTURA', centroId: 'C1', tempoPadraoMin: 45.53,
    })
    expect(criada.ok).toBe(true)
    if (!criada.ok) return

    const p = await new PublicarRoteiroService(s, s).execute({ modeloId: 'M1' })
    expect(p.ok).toBe(true)

    const r = await definir.execute({
      id: criada.value.id, modeloId: 'M1', codigo: 'COSTURA', seq: 20, nome: 'FECHA',
      centroId: 'C1', tempoPadraoMin: 30,
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('abrir_revisao_roteiro')

    // a linha publicada segue INTACTA: o roteiro que custeia não foi tocado
    const rows = await opsDoModelo(s)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.data.status).toBe('publicada')
    expect(rows[0]!.data.rev).toBe(1)
    expect(rows[0]!.data.tempo_padrao_min).toBe(45.53)   // NÃO virou 30

    const roteiro = await new ObterRoteiroService(s, s).execute({ modeloId: 'M1' })
    expect(roteiro?.rev).toBe(1)
    expect(roteiro?.operacoes).toHaveLength(1)           // o roteiro NÃO sumiu
  })

  // O `codigo` é a IDENTIDADE ESTÁVEL da operação: a linha da ficha técnica (operacao_codigo)
  // aponta para ele para dizer ONDE cada insumo é consumido, e ele atravessa as revisões. O update
  // reescreve a linha inteira a partir do comando, então deixar o codigo passar RE-IDENTIFICARIA a
  // operação e ORFANARIA toda atribuição que aponta para o código antigo — em silêncio, porque a
  // atribuição pendurada só vira erro (soft) na explosão seguinte. Trocar de operação é criar outra.
  it('REJECTS changing the codigo on update (a identidade da operação é imutável)', async () => {
    const s = seedManufacturing()
    const definir = new DefinirOperacaoService(s, s)

    const criada = await definir.execute({
      modeloId: 'M1', codigo: 'CORTE', seq: 10, nome: 'CORTE', centroId: 'C1', tempoPadraoMin: 10,
    })
    expect(criada.ok).toBe(true)
    if (!criada.ok) return

    // mesmo em RASCUNHO (onde a edição é permitida), o codigo não pode virar outro
    const r = await definir.execute({
      id: criada.value.id, modeloId: 'M1', codigo: 'BORDADO', seq: 10, nome: 'CORTE',
      centroId: 'C1', tempoPadraoMin: 10,
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('CORTE')
    expect(r.error).toContain('BORDADO')
    expect(r.error).toContain('imutável')

    // a linha continua sendo o CORTE: nenhuma ficha atribuída a CORTE foi orfanada
    const rows = await opsDoModelo(s)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.data.codigo).toBe('CORTE')

    // e o resto do update (tempo, seq, nome) continua funcionando com o MESMO codigo
    const ok2 = await definir.execute({
      id: criada.value.id, modeloId: 'M1', codigo: 'CORTE', seq: 15, nome: 'CORTE REVISADO',
      centroId: 'C1', tempoPadraoMin: 12,
    })
    expect(ok2.ok).toBe(true)
    const depois = await opsDoModelo(s)
    expect(depois[0]!.data.tempo_padrao_min).toBe(12)
    expect(depois[0]!.data.nome).toBe('CORTE REVISADO')
  })

  it('fails when the given id does not exist', async () => {
    const s = seedManufacturing()
    const r = await new DefinirOperacaoService(s, s).execute({
      id: 'nao-existe', modeloId: 'M1', codigo: 'X', seq: 10, nome: 'X', centroId: 'C1', tempoPadraoMin: 1,
    })
    expect(r.ok).toBe(false)
  })
})
