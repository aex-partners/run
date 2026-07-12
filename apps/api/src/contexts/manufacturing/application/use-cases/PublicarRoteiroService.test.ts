import { describe, it, expect } from 'vitest'
import { seedManufacturing } from '@/contexts/manufacturing/adapters/out/fake/testWorld'
import { DefinirOperacaoService } from '@/contexts/manufacturing/application/use-cases/DefinirOperacaoService'
import { PublicarRoteiroService } from '@/contexts/manufacturing/application/use-cases/PublicarRoteiroService'
import { ObterRoteiroService } from '@/contexts/manufacturing/application/use-cases/ObterRoteiroService'
import { AbrirRevisaoRoteiroService } from '@/contexts/manufacturing/application/use-cases/AbrirRevisaoRoteiroService'

describe('PublicarRoteiro + ObterRoteiro', () => {
  it('publishes drafts as rev 1 and ObterRoteiro then returns them with the work center', async () => {
    const s = seedManufacturing()
    const definir = new DefinirOperacaoService(s, s)
    const publicar = new PublicarRoteiroService(s, s)
    const obter = new ObterRoteiroService(s, s)

    expect(await obter.execute({ modeloId: 'M1' })).toBeNull()      // nada publicado ainda

    await definir.execute({ modeloId: 'M1', codigo: 'COSTURA', seq: 10, nome: 'COSTURA', centroId: 'C1', tempoPadraoMin: 45.53, agregada: true })
    expect(await obter.execute({ modeloId: 'M1' })).toBeNull()      // rascunho não conta

    const p = await publicar.execute({ modeloId: 'M1' })
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.value.rev).toBe(1)
    expect(p.value.operacoes).toBe(1)      // o chamador vê QUANTAS operações entraram na revisão

    const r = await obter.execute({ modeloId: 'M1' })
    expect(r?.rev).toBe(1)
    expect(r?.operacoes).toEqual([{ id: expect.any(String), codigo: 'COSTURA', seq: 10, centroId: 'C1',
      tempoPadraoMin: 45.53, tempoPorTamanho: {}, tempoSetupMin: 0, loteSetup: 1 }])
    expect(r?.centros).toEqual([{ id: 'C1', custoMinMod: 1 }])
  })

  // REFINO agregado -> detalhado, DELIBERADO (substituirTudo): a rev 2 tem SÓ as linhas finas. As
  // operações da rev 1 NÃO são arrastadas para a rev 2 — se fossem, a linha COSTURA agregada
  // (45,53 min) sobreviveria ao lado das finas que a substituem e o tempo entraria DUAS VEZES no
  // custo. É por isso que descartar a COSTURA aqui é o COMPORTAMENTO CERTO, e por isso a guarda de
  // completude precisa de uma válvula EXPLÍCITA em vez de simplesmente proibir o descarte.
  it('substituirTudo: a second publish bumps to rev 2 and ObterRoteiro serves only the new rev', async () => {
    const s = seedManufacturing()
    const definir = new DefinirOperacaoService(s, s)
    const publicar = new PublicarRoteiroService(s, s)
    const obter = new ObterRoteiroService(s, s)
    await definir.execute({ modeloId: 'M1', codigo: 'COSTURA', seq: 10, nome: 'COSTURA', centroId: 'C1', tempoPadraoMin: 45.53 })
    await publicar.execute({ modeloId: 'M1' })
    // refina: duas operações finas (linhas NOVAS, sem id: não estamos editando a publicada)
    await definir.execute({ modeloId: 'M1', codigo: 'PREPARA', seq: 10, nome: 'PREPARA', centroId: 'C1', tempoPadraoMin: 15, agregada: false })
    await definir.execute({ modeloId: 'M1', codigo: 'FECHA', seq: 20, nome: 'FECHA', centroId: 'C1', tempoPadraoMin: 30, agregada: false })
    const p2 = await publicar.execute({ modeloId: 'M1', substituirTudo: true })
    expect(p2.ok).toBe(true)
    if (!p2.ok) return
    expect(p2.value.rev).toBe(2)
    expect(p2.value.operacoes).toBe(2)
    const r = await obter.execute({ modeloId: 'M1' })
    expect(r?.rev).toBe(2)
    expect(r?.operacoes.map((o) => o.tempoPadraoMin)).toEqual([15, 30])   // 45, não 90,53
    expect(r?.operacoes.map((o) => o.codigo)).toEqual(['PREPARA', 'FECHA'])
    // a COSTURA agregada NÃO é arrastada: 15 + 30 = 45, e NÃO 45,53 + 45 = 90,53
    expect(r?.operacoes.reduce((sum, o) => sum + o.tempoPadraoMin, 0)).toBe(45)
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
      await definir.execute({ modeloId: 'M1', codigo: `OP${i}`, seq: i * 10, nome: `OP${i}`, centroId: 'C1', tempoPadraoMin: 5 })
    }
    const p = await publicar.execute({ modeloId: 'M1' })
    expect(p.ok).toBe(true)

    // rev 2 em RASCUNHO: 45 operações novas => 53 linhas para o modelo. Truncando em 50 e
    // mantendo as mais NOVAS, 3 das 8 ops publicadas caem fora: o roteiro voltaria com 5 de 8.
    for (let i = 1; i <= 45; i++) {
      await definir.execute({ modeloId: 'M1', codigo: `DRAFT${i}`, seq: 1000 + i, nome: `DRAFT${i}`, centroId: 'C1', tempoPadraoMin: 3 })
    }

    const r = await obter.execute({ modeloId: 'M1' })
    expect(r?.rev).toBe(1)                                              // rascunhos não contam
    expect(r?.operacoes).toHaveLength(8)                                // NENHUMA op publicada perdida
    expect(r?.operacoes.reduce((sum, o) => sum + o.tempoPadraoMin, 0)).toBeCloseTo(40, 6)
    expect(r?.centros).toEqual([{ id: 'C1', custoMinMod: 1 }])
  })
})

// GUARDA DE COMPLETUDE. Uma revisão é o roteiro COMPLETO e o publish promove SÓ os rascunhos:
// publicar um rascunho que não contém tudo APAGA operações do custo. A guarda de "operação
// publicada é imutável" só cobre a via de EDIÇÃO — a via de CRIAÇÃO não toca em nada publicado e
// passava direto. É este bloco que fecha a porta.
describe('PublicarRoteiro — a revisão nova tem de conter o roteiro publicado inteiro', () => {
  const publicarTres = async (s: ReturnType<typeof seedManufacturing>) => {
    const definir = new DefinirOperacaoService(s, s)
    await definir.execute({ modeloId: 'M1', codigo: 'CORTE', seq: 10, nome: 'CORTE', centroId: 'C1', tempoPadraoMin: 10 })
    await definir.execute({ modeloId: 'M1', codigo: 'COSTURA', seq: 20, nome: 'COSTURA', centroId: 'C1', tempoPadraoMin: 20 })
    await definir.execute({ modeloId: 'M1', codigo: 'ACABAMENTO', seq: 30, nome: 'ACABAMENTO', centroId: 'C1', tempoPadraoMin: 15 })
    expect((await new PublicarRoteiroService(s, s).execute({ modeloId: 'M1' })).ok).toBe(true)   // 45 min
  }

  // O BUG CRÍTICO, pela via CREATE. "Adicionar uma operação" é um pedido tão natural quanto
  // "mudar um tempo": definir_operacao SEM id cria UM rascunho, não toca em nenhuma linha
  // publicada (a guarda de `publicada` nunca dispara) e o publish seguinte promovia SÓ esse
  // rascunho. Resultado ANTES desta guarda: rev 2 = [BORDADO], 8 min em vez de 53 — CORTE,
  // COSTURA e ACABAMENTO sumiam do custo, com `erros` vazio. Dinheiro errado, em silêncio.
  it('adicionar UMA operação (sem id) e publicar FALHA nomeando as que ficaram de fora', async () => {
    const s = seedManufacturing()
    const obter = new ObterRoteiroService(s, s)
    await publicarTres(s)

    // o "append" ingênuo: um rascunho novo, sozinho
    await new DefinirOperacaoService(s, s).execute({
      modeloId: 'M1', codigo: 'BORDADO', seq: 40, nome: 'BORDADO', centroId: 'C1', tempoPadraoMin: 8,
    })

    const p = await new PublicarRoteiroService(s, s).execute({ modeloId: 'M1' })
    expect(p.ok).toBe(false)                                  // ALTO, não em silêncio
    if (p.ok) return
    expect(p.error).toContain('CORTE')                        // nomeia as TRÊS que faltam
    expect(p.error).toContain('COSTURA')
    expect(p.error).toContain('ACABAMENTO')
    expect(p.error).toContain('rev 1')
    expect(p.error).toContain('abrir_revisao_roteiro')        // e o caminho certo
    expect(p.error).toContain('substituirTudo')               // e a válvula, se for de propósito

    // NADA foi publicado: o roteiro que custeia continua o de 3 operações / 45 min
    const roteiro = await obter.execute({ modeloId: 'M1' })
    expect(roteiro?.rev).toBe(1)
    expect(roteiro?.operacoes).toHaveLength(3)
    expect(roteiro?.operacoes.reduce((sum, o) => sum + o.tempoPadraoMin, 0)).toBe(45)

    // O CAMINHO CERTO: abrir a revisão (clona as 3) e adicionar a 4ª ao rascunho.
    // (o BORDADO solto já está em rascunho, então abrir_revisao_roteiro recusaria: limpo-o antes,
    // que é o que o engenheiro faria ao seguir a mensagem de erro)
    const soltas = (await s.query('OPERACOES', [{ field: 'modelo', op: 'eq', value: 'M1' }], 500))
      .filter((r) => r.data.status === 'rascunho')
    for (const r of soltas) await s.delete(r.id)

    const ab = await new AbrirRevisaoRoteiroService(s, s).execute({ modeloId: 'M1' })
    expect(ab.ok).toBe(true)
    await new DefinirOperacaoService(s, s).execute({
      modeloId: 'M1', codigo: 'BORDADO', seq: 40, nome: 'BORDADO', centroId: 'C1', tempoPadraoMin: 8,
    })

    const p2 = await new PublicarRoteiroService(s, s).execute({ modeloId: 'M1' })
    expect(p2.ok).toBe(true)
    if (!p2.ok) return
    expect(p2.value.rev).toBe(2)
    expect(p2.value.operacoes).toBe(4)

    const depois = await obter.execute({ modeloId: 'M1' })
    expect(depois?.rev).toBe(2)
    expect(depois?.operacoes.map((o) => o.codigo)).toEqual(['CORTE', 'COSTURA', 'ACABAMENTO', 'BORDADO'])
    expect(depois?.operacoes.reduce((sum, o) => sum + o.tempoPadraoMin, 0)).toBe(53)   // 10+20+15+8
  })

  // SUBSTITUIÇÃO DELIBERADA: agregado -> detalhado. A COSTURA agregada é descartada DE PROPÓSITO
  // (as finas a substituem) — arrastá-la contaria o tempo DUAS vezes. A guarda tem de sair da
  // frente quando o chamador diz que é isso mesmo, e as operações publicadas NUNCA são carregadas.
  it('substituirTudo=true: publica só os rascunhos, descartando a operação agregada (45, não 90)', async () => {
    const s = seedManufacturing()
    const definir = new DefinirOperacaoService(s, s)
    const publicar = new PublicarRoteiroService(s, s)

    await definir.execute({ modeloId: 'M1', codigo: 'COSTURA', seq: 10, nome: 'COSTURA', centroId: 'C1', tempoPadraoMin: 45 })
    await publicar.execute({ modeloId: 'M1' })

    await definir.execute({ modeloId: 'M1', codigo: 'PREPARA', seq: 10, nome: 'PREPARA', centroId: 'C1', tempoPadraoMin: 15, agregada: false })
    await definir.execute({ modeloId: 'M1', codigo: 'FECHA', seq: 20, nome: 'FECHA', centroId: 'C1', tempoPadraoMin: 30, agregada: false })

    // sem a válvula, a guarda barra (COSTURA sumiria)
    const barrado = await publicar.execute({ modeloId: 'M1' })
    expect(barrado.ok).toBe(false)

    const p = await publicar.execute({ modeloId: 'M1', substituirTudo: true })
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.value.rev).toBe(2)
    expect(p.value.operacoes).toBe(2)

    const r = await new ObterRoteiroService(s, s).execute({ modeloId: 'M1' })
    expect(r?.operacoes.map((o) => o.codigo)).toEqual(['PREPARA', 'FECHA'])   // a COSTURA saiu
    expect(r?.operacoes.reduce((sum, o) => sum + o.tempoPadraoMin, 0)).toBe(45)  // 15+30, NÃO 90
  })

  // CLONE PARCIAL. `AbrirRevisaoRoteiro` faz N inserts NÃO transacionais: um crash no meio deixa
  // um rascunho com PARTE da revisão. Antes da guarda, publicar_roteiro promovia esse conjunto
  // parcial alegremente e as operações que não chegaram a ser clonadas sumiam do custo. Agora o
  // publish falha ALTO e o estado parcial é recuperável (o rascunho está lá para ser completado).
  it('clone PARCIAL (crash no meio de abrir_revisao_roteiro): publicar FALHA em vez de perder a operação', async () => {
    const s = seedManufacturing()
    await publicarTres(s)

    // simula o clone interrompido: só 2 das 3 operações viraram rascunho
    s.seedRecord('OPERACOES', { id: 'clone1', version: 1, data: {
      modelo: 'M1', codigo: 'CORTE', seq: 10, nome: 'CORTE', centro: 'C1', tempo_padrao_min: 10,
      tempo_por_tamanho: '{}', tempo_setup_min: 0, lote_setup: 1, agregada: true, rev: 0, status: 'rascunho' } })
    s.seedRecord('OPERACOES', { id: 'clone2', version: 1, data: {
      modelo: 'M1', codigo: 'COSTURA', seq: 20, nome: 'COSTURA', centro: 'C1', tempo_padrao_min: 20,
      tempo_por_tamanho: '{}', tempo_setup_min: 0, lote_setup: 1, agregada: true, rev: 0, status: 'rascunho' } })

    const p = await new PublicarRoteiroService(s, s).execute({ modeloId: 'M1' })
    expect(p.ok).toBe(false)
    if (p.ok) return
    expect(p.error).toContain('ACABAMENTO')                   // a que não chegou a ser clonada
    expect(p.error).not.toContain('CORTE')                    // só nomeia o que FALTA

    // o roteiro publicado continua inteiro: nada foi perdido
    const roteiro = await new ObterRoteiroService(s, s).execute({ modeloId: 'M1' })
    expect(roteiro?.rev).toBe(1)
    expect(roteiro?.operacoes).toHaveLength(3)
    expect(roteiro?.operacoes.reduce((sum, o) => sum + o.tempoPadraoMin, 0)).toBe(45)
  })

  // A guarda é VAZIA sem revisão publicada: o primeiro publish não tem o que perder.
  it('sem revisão publicada, o primeiro publish é livre (a guarda não tem baseline)', async () => {
    const s = seedManufacturing()
    await new DefinirOperacaoService(s, s).execute({
      modeloId: 'M1', codigo: 'CORTE', seq: 10, nome: 'CORTE', centroId: 'C1', tempoPadraoMin: 10,
    })
    const p = await new PublicarRoteiroService(s, s).execute({ modeloId: 'M1' })
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.value.rev).toBe(1)
  })
})
