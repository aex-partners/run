import { EntityRegistry } from '@/contexts/manufacturing/application/ports/out/EntityRegistry'
import { RecordStore } from '@/contexts/manufacturing/application/ports/out/RecordStore'
import { ListarCentros } from '@/contexts/manufacturing/application/ports/in/ListarCentros'
import { RoteiroCentroView } from '@/contexts/manufacturing/application/ports/in/ObterRoteiro'

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0)) || 0

// Teto do query engine do data (`Math.min(limit ?? 50, 500)`): listar centros sem limite explícito
// esconderia os centros mais antigos assim que a fábrica passasse de 50 cadastrados.
const LIMITE = 500

export class ListarCentrosService implements ListarCentros {
  constructor(private readonly store: RecordStore, private readonly registry: EntityRegistry) {}

  async execute(): Promise<RoteiroCentroView[]> {
    const centrosId = await this.registry.entityIdBySlug('centros_de_trabalho')
    if (!centrosId) return []
    const rows = await this.store.query(centrosId, [], LIMITE)
    return rows.map((r) => ({
      id: r.id,
      custoMinMod: r.data.custo_min_mod == null ? null : num(r.data.custo_min_mod),
    }))
  }
}
