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

// Abre (ou COMPLEMENTA) a revisão em rascunho, clonando da revisão publicada SÓ as operações
// cujo `codigo` ainda não existe no rascunho atual. TOP-UP IDEMPOTENTE, não "fail se já aberto".
//
// É a peça que torna estrutural a regra "uma revisão é um CONJUNTO COMPLETO de operações".
// `PublicarRoteiro` promove apenas RASCUNHOS; se o engenheiro editasse só a operação que quer
// mudar, a revisão publicada conteria APENAS ela e as demais sumiriam do custo. Clonando o
// conjunto completo ANTES da edição, o rascunho já nasce inteiro e o publish não perde nada.
//
// POR QUE TOP-UP (e não "fail se já há rascunho", como antes): este use-case faz N inserts NÃO
// transacionais. Um crash no meio deixava o rascunho PARCIAL — e com a guarda antiga isso era um
// beco sem saída: publicar recusava (incompleto) e abrir de novo TAMBÉM recusava (já aberto), sem
// acesso direto ao banco não tinha como sair. Rodar de novo agora é sempre seguro: só clona o que
// falta e NUNCA sobrescreve/duplica uma linha de rascunho já existente — uma edição em andamento
// sobrevive intocada, que é exatamente a garantia que a guarda antiga existia para proteger.
//
// O `codigo` (identidade estável da operação no modelo) é preservado no clone: é ele que mantém
// de pé a atribuição insumo -> operação das fichas técnicas através das revisões.
export class AbrirRevisaoRoteiroService implements AbrirRevisaoRoteiro {
  constructor(private readonly store: RecordStore, private readonly registry: EntityRegistry) {}

  async execute(cmd: { modeloId: string }): Promise<Result<{ operacoes: number; complementadas: number }>> {
    const opsId = await this.registry.entityIdBySlug('operacoes')
    if (!opsId) return fail(ManufacturingError.entidadeFaltando)

    const rows = await this.store.query(opsId, [{ field: 'modelo', op: 'eq', value: cmd.modeloId }], LIMITE)

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

    // MESMA seleção que o costing enxerga (última rev publicada): o rascunho completado é, por
    // construção, exatamente o roteiro que está custeando hoje. Sem revisão publicada não há o
    // que clonar — mesmo com rascunho parcial no ar, o caminho é criar direto (definir_operacao).
    const roteiro = selecionarRoteiroPublicado(cmd.modeloId, ops)
    if (!roteiro) return fail(ManufacturingError.semRoteiroPublicado)

    const rascunhos = rows.filter((r) => r.data.status === 'rascunho')
    const noRascunho = new Set(rascunhos.map((r) => String(r.data.codigo ?? '')))

    const porId = new Map(rows.map((r) => [r.id, r]))
    let complementadas = 0
    for (const op of roteiro.operacoes) {
      if (noRascunho.has(op.codigo)) continue     // já está no rascunho: NUNCA sobrescreve/duplica
      const origem = porId.get(op.id)
      if (!origem) continue
      // Copia o RAW da linha de origem (preserva tempo_por_tamanho já serializado, agregada,
      // codigo, etc. — inclusive campos que este use-case nem conhece) e só reescreve o que
      // define um RASCUNHO NOVO: linha nova (insert), rev 0, status rascunho.
      await this.store.insert(opsId, { ...origem.data, rev: 0, status: 'rascunho' })
      complementadas++
    }

    return ok({ operacoes: rascunhos.length + complementadas, complementadas })
  }
}
