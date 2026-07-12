import { Result, ok, fail } from '@/shared/kernel/Result'
import { EntityRegistry } from '@/contexts/manufacturing/application/ports/out/EntityRegistry'
import { RecordStore } from '@/contexts/manufacturing/application/ports/out/RecordStore'
import { AbrirRevisaoRoteiro } from '@/contexts/manufacturing/application/ports/in/AbrirRevisaoRoteiro'
import { ManufacturingError } from '@/contexts/manufacturing/domain/ManufacturingError'
import { selecionarRoteiroPublicado, OperacaoRow } from '@/contexts/manufacturing/domain/Roteiro'

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0)) || 0

// Teto do query engine do data (`Math.min(limit ?? 50, 500)`): o clone precisa enxergar TODAS as
// linhas de `operacoes` do modelo. Truncar em 50 esconderia parte da revisão publicada e o
// rascunho nasceria INCOMPLETO — exatamente o buraco que este use-case existe para fechar.
const LIMITE = 500

// Abre uma nova revisão CLONANDO a revisão publicada inteira para rascunho.
//
// É a peça que torna estrutural a regra "uma revisão é um CONJUNTO COMPLETO de operações".
// `PublicarRoteiro` promove apenas RASCUNHOS; se o engenheiro editasse só a operação que quer
// mudar, a revisão publicada conteria APENAS ela e as demais sumiriam do custo. Clonando o
// conjunto completo ANTES da edição, o rascunho já nasce inteiro e o publish não perde nada.
//
// O `codigo` (identidade estável da operação no modelo) é preservado no clone: é ele que mantém
// de pé a atribuição insumo -> operação das fichas técnicas através das revisões.
export class AbrirRevisaoRoteiroService implements AbrirRevisaoRoteiro {
  constructor(private readonly store: RecordStore, private readonly registry: EntityRegistry) {}

  async execute(cmd: { modeloId: string }): Promise<Result<{ operacoes: number }>> {
    const opsId = await this.registry.entityIdBySlug('operacoes')
    if (!opsId) return fail(ManufacturingError.entidadeFaltando)

    const rows = await this.store.query(opsId, [{ field: 'modelo', op: 'eq', value: cmd.modeloId }], LIMITE)

    // Já há rascunho: a revisão está aberta. Clonar de novo DUPLICARIA as operações no
    // rascunho (e, na publicação, o tempo de cada uma entraria duas vezes no custo).
    if (rows.some((r) => r.data.status === 'rascunho')) return fail(ManufacturingError.revisaoJaAberta)

    const ops: OperacaoRow[] = rows.map((r) => ({
      id: r.id,
      codigo: String(r.data.codigo ?? ''),
      seq: num(r.data.seq),
      nome: String(r.data.nome ?? ''),
      centroId: r.data.centro == null || r.data.centro === '' ? null : String(r.data.centro),
      tempoPadraoMin: num(r.data.tempo_padrao_min),
      tempoPorTamanho: {},                       // não usado aqui: o clone copia o RAW abaixo
      tempoSetupMin: num(r.data.tempo_setup_min),
      loteSetup: num(r.data.lote_setup) || 1,
      agregada: r.data.agregada === true,
      rev: num(r.data.rev),
      status: String(r.data.status ?? ''),
    }))

    // MESMA seleção que o costing enxerga (última rev publicada): o rascunho clonado é, por
    // construção, exatamente o roteiro que está custeando hoje.
    const roteiro = selecionarRoteiroPublicado(cmd.modeloId, ops)
    if (!roteiro) return fail(ManufacturingError.semRoteiroPublicado)

    const porId = new Map(rows.map((r) => [r.id, r]))
    for (const op of roteiro.operacoes) {
      const origem = porId.get(op.id)
      if (!origem) continue
      // Copia o RAW da linha de origem (preserva tempo_por_tamanho já serializado, agregada,
      // codigo, etc. — inclusive campos que este use-case nem conhece) e só reescreve o que
      // define um RASCUNHO NOVO: linha nova (insert), rev 0, status rascunho.
      await this.store.insert(opsId, { ...origem.data, rev: 0, status: 'rascunho' })
    }

    return ok({ operacoes: roteiro.operacoes.length })
  }
}
