import { Result, ok, fail } from '@/shared/kernel/Result'
import { EntityRegistry } from '@/contexts/manufacturing/application/ports/out/EntityRegistry'
import { RecordStore } from '@/contexts/manufacturing/application/ports/out/RecordStore'
import { DescartarRascunhoRoteiro } from '@/contexts/manufacturing/application/ports/in/DescartarRascunhoRoteiro'
import { ManufacturingError } from '@/contexts/manufacturing/domain/ManufacturingError'

// Teto do query engine do data (`Math.min(limit ?? 50, 500)`): tem de enxergar TODOS os
// rascunhos do modelo para apagar TODOS — sobrar um rascunho velho por causa de um limite baixo
// deixaria o modelo "quase" destravado, o mesmo tipo de armadilha silenciosa que este use-case
// existe para tirar o usuário.
const LIMITE = 500

// Abandona a revisão em rascunho: apaga TODO rascunho de operação do modelo, sem tocar na
// revisão publicada. É a saída de emergência para (a) desistir de uma edição em andamento e
// recomeçar, ou (b) destravar um rascunho PARCIAL (AbrirRevisaoRoteiro interrompido no meio dos
// N inserts não transacionais) voltando ao zero em vez de completá-lo via top-up.
export class DescartarRascunhoRoteiroService implements DescartarRascunhoRoteiro {
  constructor(private readonly store: RecordStore, private readonly registry: EntityRegistry) {}

  async execute(cmd: { modeloId: string }): Promise<Result<{ descartadas: number }>> {
    const opsId = await this.registry.entityIdBySlug('operacoes')
    if (!opsId) return fail(ManufacturingError.entidadeFaltando)

    const rows = await this.store.query(opsId, [{ field: 'modelo', op: 'eq', value: cmd.modeloId }], LIMITE)
    const rascunhos = rows.filter((r) => r.data.status === 'rascunho')

    for (const r of rascunhos) await this.store.delete(r.id)

    return ok({ descartadas: rascunhos.length })
  }
}
