import { EntityRegistry } from '@/contexts/manufacturing/application/ports/out/EntityRegistry'
import { RecordStore } from '@/contexts/manufacturing/application/ports/out/RecordStore'
import { ListarCentros } from '@/contexts/manufacturing/application/ports/in/ListarCentros'
import { RoteiroCentroView } from '@/contexts/manufacturing/application/ports/in/ObterRoteiro'

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0)) || 0

export class ListarCentrosService implements ListarCentros {
  constructor(private readonly store: RecordStore, private readonly registry: EntityRegistry) {}

  async execute(): Promise<RoteiroCentroView[]> {
    const centrosId = await this.registry.entityIdBySlug('centros_de_trabalho')
    if (!centrosId) return []
    const rows = await this.store.query(centrosId, [])
    return rows.map((r) => ({
      id: r.id,
      custoMinMod: r.data.custo_min_mod == null ? null : num(r.data.custo_min_mod),
    }))
  }
}
