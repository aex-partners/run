import { Result, ok, fail } from '@/shared/kernel/Result'
import { EntityRegistry } from '@/contexts/costing/application/ports/out/EntityRegistry'
import { RecordStore } from '@/contexts/costing/application/ports/out/RecordStore'
import { PublicarRevisao } from '@/contexts/costing/application/ports/in/PublicarRevisao'
import { CostingError } from '@/contexts/costing/domain/CostingError'
const n = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0)) || 0

export class PublicarRevisaoService implements PublicarRevisao {
  constructor(private readonly store: RecordStore, private readonly registry: EntityRegistry) {}
  async execute(cmd: { modeloId: string }): Promise<Result<{ rev: number }>> {
    const fichaId = await this.registry.entityIdBySlug('fichas_tecnicas')
    if (!fichaId) return fail(CostingError.entidadeFaltando)
    const rows = await this.store.query(fichaId, [{ field: 'modelo', op: 'eq', value: cmd.modeloId }])
    const rascunhos = rows.filter((r) => r.data.status === 'rascunho')
    if (rascunhos.length === 0) return fail('nenhum rascunho para publicar')
    const maxPub = Math.max(0, ...rows.filter((r) => r.data.status === 'publicada').map((r) => n(r.data.rev)))
    const rev = maxPub + 1
    for (const r of rascunhos) await this.store.update(r.id, { ...r.data, status: 'publicada', rev }, r.version)
    return ok({ rev })
  }
}
