import { Result, ok, fail } from '@/shared/kernel/Result'
import { EntityRegistry } from '@/contexts/manufacturing/application/ports/out/EntityRegistry'
import { RecordStore } from '@/contexts/manufacturing/application/ports/out/RecordStore'
import { PublicarRoteiro } from '@/contexts/manufacturing/application/ports/in/PublicarRoteiro'
import { ManufacturingError } from '@/contexts/manufacturing/domain/ManufacturingError'
import { selecionarRoteiroPublicado, proximaRev, OperacaoRow } from '@/contexts/manufacturing/domain/Roteiro'

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0)) || 0

// Teto do query engine do data (`Math.min(limit ?? 50, 500)`): a próxima rev e a GUARDA DE
// COMPLETUDE são apuradas sobre TODAS as linhas de `operacoes` do modelo. Truncar em 50 esconderia
// revisões (rev errada) e operações publicadas (a guarda deixaria passar uma revisão incompleta).
const LIMITE = 500

export class PublicarRoteiroService implements PublicarRoteiro {
  constructor(private readonly store: RecordStore, private readonly registry: EntityRegistry) {}

  // Promove SÓ os rascunhos: a nova revisão é EXATAMENTE o conjunto de rascunhos existentes.
  // As operações da revisão anterior NÃO são carregadas para a nova de propósito — arrastá-las
  // DUPLICARIA tempo no refino de agregado -> detalhado (a linha COSTURA agregada sobreviveria
  // ao lado das linhas finas que a substituem).
  //
  // Como "a revisão é o conjunto de rascunhos" e não um delta, um rascunho INCOMPLETO apaga
  // operações do custo. A GUARDA DE COMPLETUDE abaixo torna isso impossível em silêncio: todo
  // `codigo` da revisão publicada tem de estar no rascunho, ou o publish FALHA nomeando o que
  // falta. Fecha os três caminhos que restavam:
  //   1. ADICIONAR uma operação (definir_operacao sem id) — cria UM rascunho e não toca em nada
  //      publicado, então a guarda de "operação publicada é imutável" nunca dispara; publicar
  //      deixaria a rev nova com APENAS a operação adicionada.
  //   2. AbrirRevisaoRoteiro faz N inserts NÃO transacionais: um crash no meio do clone deixa um
  //      rascunho PARCIAL, que o publish promoveria alegremente, perdendo o resto.
  //   3. Rascunho semeado/editado por fora do fluxo.
  // `substituirTudo` é a válvula EXPLÍCITA para o refino deliberado (agregado -> detalhado).
  async execute(cmd: { modeloId: string; substituirTudo?: boolean }): Promise<Result<{ rev: number; operacoes: number }>> {
    const opsId = await this.registry.entityIdBySlug('operacoes')
    if (!opsId) return fail(ManufacturingError.entidadeFaltando)
    const rows = await this.store.query(opsId, [{ field: 'modelo', op: 'eq', value: cmd.modeloId }], LIMITE)
    const rascunhos = rows.filter((r) => r.data.status === 'rascunho')
    if (rascunhos.length === 0) return fail(ManufacturingError.semRascunho)

    const ops: OperacaoRow[] = rows.map((r) => ({
      id: r.id,
      codigo: String(r.data.codigo ?? ''),
      seq: num(r.data.seq),
      nome: String(r.data.nome ?? ''),
      centroId: r.data.centro == null || r.data.centro === '' ? null : String(r.data.centro),
      tempoPadraoMin: num(r.data.tempo_padrao_min),
      tempoPorTamanho: {},
      tempoSetupMin: num(r.data.tempo_setup_min),
      loteSetup: num(r.data.lote_setup) || 1,
      agregada: r.data.agregada === true,
      rev: num(r.data.rev),
      status: String(r.data.status ?? ''),
    }))

    // GUARDA DE COMPLETUDE. Vazia quando ainda não há revisão publicada (o primeiro publish é
    // livre) e quando o chamador pediu substituição deliberada.
    if (!cmd.substituirTudo) {
      // MESMA seleção que o costing enxerga (última rev publicada): é exatamente o roteiro que
      // está custeando hoje e que a nova revisão vai APAGAR se não o contiver.
      const publicado = selecionarRoteiroPublicado(cmd.modeloId, ops)
      if (publicado) {
        const noRascunho = new Set(rascunhos.map((r) => String(r.data.codigo ?? '')))
        const faltando = [...new Set(publicado.operacoes.map((o) => o.codigo))]
          .filter((c) => c !== '' && !noRascunho.has(c))
        if (faltando.length > 0) return fail(ManufacturingError.revisaoIncompleta(faltando, publicado.rev))
      }
    }

    const rev = proximaRev(ops)
    for (const r of rascunhos) await this.store.update(r.id, { ...r.data, status: 'publicada', rev }, r.version)
    return ok({ rev, operacoes: rascunhos.length })
  }
}
