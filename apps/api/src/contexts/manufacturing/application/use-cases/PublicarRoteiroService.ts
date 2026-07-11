import { Result, ok, fail } from '@/shared/kernel/Result'
import { EntityRegistry } from '@/contexts/manufacturing/application/ports/out/EntityRegistry'
import { RecordStore } from '@/contexts/manufacturing/application/ports/out/RecordStore'
import { PublicarRoteiro } from '@/contexts/manufacturing/application/ports/in/PublicarRoteiro'
import { ManufacturingError } from '@/contexts/manufacturing/domain/ManufacturingError'

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0)) || 0

// Teto do query engine do data (`Math.min(limit ?? 50, 500)`): a próxima rev é apurada sobre TODAS
// as linhas de `operacoes` do modelo. Truncar em 50 esconderia revisões e a rev sairia errada.
const LIMITE = 500

export class PublicarRoteiroService implements PublicarRoteiro {
  constructor(private readonly store: RecordStore, private readonly registry: EntityRegistry) {}

  async execute(cmd: { modeloId: string }): Promise<Result<{ rev: number }>> {
    const opsId = await this.registry.entityIdBySlug('operacoes')
    if (!opsId) return fail(ManufacturingError.entidadeFaltando)
    const rows = await this.store.query(opsId, [{ field: 'modelo', op: 'eq', value: cmd.modeloId }], LIMITE)
    const rascunhos = rows.filter((r) => r.data.status === 'rascunho')
    if (rascunhos.length === 0) return fail(ManufacturingError.semRascunho)
    const rev = Math.max(0, ...rows.filter((r) => r.data.status === 'publicada').map((r) => num(r.data.rev))) + 1
    for (const r of rascunhos) await this.store.update(r.id, { ...r.data, status: 'publicada', rev }, r.version)
    return ok({ rev })
  }
}
