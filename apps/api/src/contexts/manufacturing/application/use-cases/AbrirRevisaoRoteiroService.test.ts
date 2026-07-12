import { describe, it, expect } from 'vitest'
import { seedManufacturing } from '@/contexts/manufacturing/adapters/out/fake/testWorld'
import { DefinirOperacaoService } from '@/contexts/manufacturing/application/use-cases/DefinirOperacaoService'
import { PublicarRoteiroService } from '@/contexts/manufacturing/application/use-cases/PublicarRoteiroService'
import { ObterRoteiroService } from '@/contexts/manufacturing/application/use-cases/ObterRoteiroService'
import { AbrirRevisaoRoteiroService } from '@/contexts/manufacturing/application/use-cases/AbrirRevisaoRoteiroService'

// O roteiro publicado do M1: A CORTE 10 + B COSTURA 20 + C ACABAMENTO 15 = 45 min.
const publicarTresOperacoes = async (s: ReturnType<typeof seedManufacturing>) => {
  const definir = new DefinirOperacaoService(s, s)
  await definir.execute({ modeloId: 'M1', codigo: 'CORTE', seq: 10, nome: 'CORTE', centroId: 'C1', tempoPadraoMin: 10 })
  await definir.execute({ modeloId: 'M1', codigo: 'COSTURA', seq: 20, nome: 'COSTURA', centroId: 'C1', tempoPadraoMin: 20 })
  await definir.execute({ modeloId: 'M1', codigo: 'ACABAMENTO', seq: 30, nome: 'ACABAMENTO', centroId: 'C1', tempoPadraoMin: 15 })
  const p = await new PublicarRoteiroService(s, s).execute({ modeloId: 'M1' })
  expect(p.ok).toBe(true)
}

describe('AbrirRevisaoRoteiro', () => {
  // O TESTE QUE FIXA O BUG CRÍTICO.
  // Antes: editar UMA operação publicada devolvia a linha a rascunho/rev 0, o roteiro publicado
  // caía de 3 para 2 operações NA HORA (45 -> 25 min, ~44% de subcusteio, sem erro nenhum) e o
  // publish seguinte promovia SÓ o rascunho, criando uma rev com 1 operação: A e C sumiam para
  // sempre. Agora a edição passa OBRIGATORIAMENTE por abrir_revisao_roteiro, que clona o conjunto
  // COMPLETO — então o rascunho já nasce inteiro e o publish não tem como perder operação.
  it('3 ops publicadas -> abrir revisão -> editar UMA -> publicar: as 3 continuam no roteiro', async () => {
    const s = seedManufacturing()
    const obter = new ObterRoteiroService(s, s)
    await publicarTresOperacoes(s)

    const antes = await obter.execute({ modeloId: 'M1' })
    expect(antes?.rev).toBe(1)
    expect(antes?.operacoes).toHaveLength(3)
    expect(antes?.operacoes.reduce((sum, o) => sum + o.tempoPadraoMin, 0)).toBe(45)

    // 1) abre a revisão: CLONA as 3 operações como rascunhos novos
    const ab = await new AbrirRevisaoRoteiroService(s, s).execute({ modeloId: 'M1' })
    expect(ab.ok).toBe(true)
    if (!ab.ok) return
    expect(ab.value.operacoes).toBe(3)
    expect(ab.value.complementadas).toBe(3)

    // o roteiro PUBLICADO continua intocado enquanto a revisão está aberta (o custo não oscila)
    const durante = await obter.execute({ modeloId: 'M1' })
    expect(durante?.rev).toBe(1)
    expect(durante?.operacoes).toHaveLength(3)
    expect(durante?.operacoes.reduce((sum, o) => sum + o.tempoPadraoMin, 0)).toBe(45)

    // 2) edita UMA operação do rascunho: COSTURA 20 -> 25 min
    const rascunhos = (await s.query('OPERACOES', [{ field: 'modelo', op: 'eq', value: 'M1' }], 500))
      .filter((r) => r.data.status === 'rascunho')
    expect(rascunhos).toHaveLength(3)                     // o rascunho nasceu COMPLETO
    const costura = rascunhos.find((r) => r.data.codigo === 'COSTURA')!
    const edit = await new DefinirOperacaoService(s, s).execute({
      id: costura.id, modeloId: 'M1', codigo: 'COSTURA', seq: 20, nome: 'COSTURA',
      centroId: 'C1', tempoPadraoMin: 25,
    })
    expect(edit.ok).toBe(true)

    // 3) publica: a rev 2 tem as TRÊS operações, com a edição aplicada
    const p2 = await new PublicarRoteiroService(s, s).execute({ modeloId: 'M1' })
    expect(p2.ok).toBe(true)
    if (!p2.ok) return
    expect(p2.value.rev).toBe(2)
    expect(p2.value.operacoes).toBe(3)                    // publicou o conjunto COMPLETO

    const depois = await obter.execute({ modeloId: 'M1' })
    expect(depois?.rev).toBe(2)
    expect(depois?.operacoes).toHaveLength(3)             // A e C NÃO sumiram
    expect(depois?.operacoes.map((o) => o.codigo)).toEqual(['CORTE', 'COSTURA', 'ACABAMENTO'])
    expect(depois?.operacoes.map((o) => o.tempoPadraoMin)).toEqual([10, 25, 15])
    expect(depois?.operacoes.reduce((sum, o) => sum + o.tempoPadraoMin, 0)).toBe(50)  // 10+25+15
  })

  it('o clone preserva codigo, centro, tempos e agregada — e nasce como linha NOVA (rev 0)', async () => {
    const s = seedManufacturing()
    await new DefinirOperacaoService(s, s).execute({
      modeloId: 'M1', codigo: 'CORTE', seq: 10, nome: 'CORTE', centroId: 'C1',
      tempoPadraoMin: 12, tempoPorTamanho: { T38: 14 }, tempoSetupMin: 6, loteSetup: 3, agregada: false,
    })
    await new PublicarRoteiroService(s, s).execute({ modeloId: 'M1' })

    const publicadaAntes = (await s.query('OPERACOES', [{ field: 'modelo', op: 'eq', value: 'M1' }], 500))[0]!

    const ab = await new AbrirRevisaoRoteiroService(s, s).execute({ modeloId: 'M1' })
    expect(ab.ok).toBe(true)

    const rows = await s.query('OPERACOES', [{ field: 'modelo', op: 'eq', value: 'M1' }], 500)
    expect(rows).toHaveLength(2)                          // a publicada + o clone rascunho
    const clone = rows.find((r) => r.data.status === 'rascunho')!
    expect(clone.id).not.toBe(publicadaAntes.id)          // LINHA NOVA, não a mesma
    expect(clone.data.rev).toBe(0)
    expect(clone.data.codigo).toBe('CORTE')               // identidade estável PRESERVADA
    expect(clone.data.centro).toBe('C1')
    expect(clone.data.tempo_padrao_min).toBe(12)
    expect(clone.data.tempo_por_tamanho).toBe('{"T38":14}')
    expect(clone.data.tempo_setup_min).toBe(6)
    expect(clone.data.lote_setup).toBe(3)
    expect(clone.data.agregada).toBe(false)

    // a linha publicada segue publicada e intacta
    const publicada = rows.find((r) => r.data.status === 'publicada')!
    expect(publicada.data.rev).toBe(1)
    expect(publicada.data.tempo_padrao_min).toBe(12)
  })

  it('clona apenas a ÚLTIMA revisão publicada (o histórico não volta junto)', async () => {
    const s = seedManufacturing()
    const definir = new DefinirOperacaoService(s, s)
    const publicar = new PublicarRoteiroService(s, s)

    // rev 1: uma operação agregada
    await definir.execute({ modeloId: 'M1', codigo: 'COSTURA', seq: 10, nome: 'COSTURA', centroId: 'C1', tempoPadraoMin: 45 })
    await publicar.execute({ modeloId: 'M1' })
    // rev 2: refino em duas operações finas (linhas novas). `substituirTudo`: a COSTURA agregada é
    // descartada DE PROPÓSITO (as finas a substituem), então a guarda de completude sai da frente.
    await definir.execute({ modeloId: 'M1', codigo: 'PREPARA', seq: 10, nome: 'PREPARA', centroId: 'C1', tempoPadraoMin: 15 })
    await definir.execute({ modeloId: 'M1', codigo: 'FECHA', seq: 20, nome: 'FECHA', centroId: 'C1', tempoPadraoMin: 30 })
    expect((await publicar.execute({ modeloId: 'M1', substituirTudo: true })).ok).toBe(true)

    const ab = await new AbrirRevisaoRoteiroService(s, s).execute({ modeloId: 'M1' })
    expect(ab.ok).toBe(true)
    if (!ab.ok) return
    expect(ab.value.operacoes).toBe(2)                    // clonou a rev 2 (2 ops), não a rev 1

    const rascunhos = (await s.query('OPERACOES', [{ field: 'modelo', op: 'eq', value: 'M1' }], 500))
      .filter((r) => r.data.status === 'rascunho')
    expect(rascunhos.map((r) => r.data.codigo).sort()).toEqual(['FECHA', 'PREPARA'])

    // publicar o clone reproduz a rev 2 como rev 3, sem ressuscitar a COSTURA agregada
    const p3 = await publicar.execute({ modeloId: 'M1' })
    if (!p3.ok) return
    expect(p3.value.rev).toBe(3)
    const r = await new ObterRoteiroService(s, s).execute({ modeloId: 'M1' })
    expect(r?.operacoes.reduce((sum, o) => sum + o.tempoPadraoMin, 0)).toBe(45)   // 15+30, NÃO 90
  })

  // TOP-UP IDEMPOTENTE: a versão antiga recusava rodar de novo com "revisão já aberta". Isso
  // travava o usuário sempre que um clone anterior morria no meio: publicar recusava
  // (incompleto) e abrir de novo TAMBÉM recusava (já aberto) — beco sem saída sem acesso direto
  // ao banco. Agora chamar de novo é sempre seguro e NÃO duplica nada.
  it('idempotente: chamar duas vezes seguidas sucede nas duas e não duplica rascunho', async () => {
    const s = seedManufacturing()
    await publicarTresOperacoes(s)
    const abrir = new AbrirRevisaoRoteiroService(s, s)

    const primeira = await abrir.execute({ modeloId: 'M1' })
    expect(primeira.ok).toBe(true)
    if (!primeira.ok) return
    expect(primeira.value.complementadas).toBe(3)
    expect(primeira.value.operacoes).toBe(3)

    const segunda = await abrir.execute({ modeloId: 'M1' })
    expect(segunda.ok).toBe(true)                        // sucesso, NÃO erro
    if (!segunda.ok) return
    expect(segunda.value.complementadas).toBe(0)          // nada faltava: não clonou de novo
    expect(segunda.value.operacoes).toBe(3)

    // não duplicou: 3 publicadas + 3 rascunhos, e nada além disso
    const rows = await s.query('OPERACOES', [{ field: 'modelo', op: 'eq', value: 'M1' }], 500)
    expect(rows.filter((r) => r.data.status === 'rascunho')).toHaveLength(3)
    expect(rows).toHaveLength(6)
  })

  // A EDIÇÃO EM ANDAMENTO SOBREVIVE. É a garantia que a guarda antiga ("já aberto") existia para
  // proteger — o top-up precisa preservá-la: uma segunda chamada não pode pisar no que o
  // engenheiro já editou no rascunho.
  it('edição em andamento no rascunho não é sobrescrita por um top-up subsequente', async () => {
    const s = seedManufacturing()
    await publicarTresOperacoes(s)
    const abrir = new AbrirRevisaoRoteiroService(s, s)
    expect((await abrir.execute({ modeloId: 'M1' })).ok).toBe(true)

    const rascunhos = (await s.query('OPERACOES', [{ field: 'modelo', op: 'eq', value: 'M1' }], 500))
      .filter((r) => r.data.status === 'rascunho')
    const costura = rascunhos.find((r) => r.data.codigo === 'COSTURA')!
    const edit = await new DefinirOperacaoService(s, s).execute({
      id: costura.id, modeloId: 'M1', codigo: 'COSTURA', seq: 20, nome: 'COSTURA',
      centroId: 'C1', tempoPadraoMin: 99,
    })
    expect(edit.ok).toBe(true)

    const topUp = await abrir.execute({ modeloId: 'M1' })     // rascunho já completo: no-op
    expect(topUp.ok).toBe(true)
    if (!topUp.ok) return
    expect(topUp.value.complementadas).toBe(0)

    const depois = (await s.query('OPERACOES', [{ field: 'modelo', op: 'eq', value: 'M1' }], 500))
      .find((r) => r.id === costura.id)!
    expect(depois.data.tempo_padrao_min).toBe(99)              // a edição sobreviveu ao top-up
  })

  // O CASO QUE DESTRAVA O USUÁRIO: um clone PARCIAL (crash no meio dos N inserts não
  // transacionais) fica com só 2 das 3 operações em rascunho. Antes, abrir de novo recusava
  // ("já aberto") e publicar recusava (incompleto): sem SQL direto não tinha saída. Agora abrir
  // de novo CURA o rascunho, sem tocar nas duas linhas que já estavam lá.
  it('rascunho PARCIAL: completa só o que falta (complementadas: 1, operacoes: 3) e o publish seguinte finalmente sucede', async () => {
    const s = seedManufacturing()
    await publicarTresOperacoes(s)

    // simula o clone interrompido: só CORTE e COSTURA viraram rascunho
    s.seedRecord('OPERACOES', { id: 'clone1', version: 1, data: {
      modelo: 'M1', codigo: 'CORTE', seq: 10, nome: 'CORTE', centro: 'C1', tempo_padrao_min: 10,
      tempo_por_tamanho: '{}', tempo_setup_min: 0, lote_setup: 1, agregada: true, rev: 0, status: 'rascunho' } })
    s.seedRecord('OPERACOES', { id: 'clone2', version: 1, data: {
      modelo: 'M1', codigo: 'COSTURA', seq: 20, nome: 'COSTURA', centro: 'C1', tempo_padrao_min: 20,
      tempo_por_tamanho: '{}', tempo_setup_min: 0, lote_setup: 1, agregada: true, rev: 0, status: 'rascunho' } })

    const ab = await new AbrirRevisaoRoteiroService(s, s).execute({ modeloId: 'M1' })
    expect(ab.ok).toBe(true)
    if (!ab.ok) return
    expect(ab.value.complementadas).toBe(1)                    // só ACABAMENTO faltava
    expect(ab.value.operacoes).toBe(3)                         // rascunho termina completo

    const rascunhos = (await s.query('OPERACOES', [{ field: 'modelo', op: 'eq', value: 'M1' }], 500))
      .filter((r) => r.data.status === 'rascunho')
    expect(rascunhos.map((r) => r.data.codigo).sort()).toEqual(['ACABAMENTO', 'CORTE', 'COSTURA'])
    // as duas linhas ORIGINAIS não foram tocadas (mesmo id, mesma versão)
    expect(rascunhos.find((r) => r.data.codigo === 'CORTE')!.id).toBe('clone1')
    expect(rascunhos.find((r) => r.data.codigo === 'CORTE')!.version).toBe(1)
    expect(rascunhos.find((r) => r.data.codigo === 'COSTURA')!.id).toBe('clone2')
    expect(rascunhos.find((r) => r.data.codigo === 'COSTURA')!.version).toBe(1)

    // e agora publicar SUCEDE com as 3 operações
    const p = await new PublicarRoteiroService(s, s).execute({ modeloId: 'M1' })
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.value.rev).toBe(2)
    expect(p.value.operacoes).toBe(3)
  })

  it('falha quando o modelo não tem revisão publicada para clonar', async () => {
    const s = seedManufacturing()
    const r = await new AbrirRevisaoRoteiroService(s, s).execute({ modeloId: 'M1' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('definir_operacao')     // o caminho certo: criar rascunho direto
  })
})
