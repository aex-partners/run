import { EntityRegistry } from '@/contexts/costing/application/ports/out/EntityRegistry'
import { RecordStore } from '@/contexts/costing/application/ports/out/RecordStore'
import { HistoricoCusto, SnapshotView } from '@/contexts/costing/application/ports/in/HistoricoCusto'
const n = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0)) || 0

export class HistoricoCustoService implements HistoricoCusto {
  constructor(private readonly store: RecordStore, private readonly registry: EntityRegistry) {}
  async execute(q: { skuId: string }): Promise<SnapshotView[]> {
    const id = await this.registry.entityIdBySlug('snapshots_custo')
    if (!id) return []
    const rows = await this.store.query(id, [{ field: 'sku', op: 'eq', value: q.skuId }])
    return rows
      .map((r) => ({ data: String(r.data.data ?? ''), custoTotal: n(r.data.custo_total), origemRev: n(r.data.origem_rev) }))
      .sort((a, b) => a.data.localeCompare(b.data))
  }
}
