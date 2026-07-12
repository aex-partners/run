import { EntityRegistry } from '@/contexts/manufacturing/application/ports/out/EntityRegistry'
import { RecordStore } from '@/contexts/manufacturing/application/ports/out/RecordStore'
import { ListarCentros, CentroView } from '@/contexts/manufacturing/application/ports/in/ListarCentros'

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0)) || 0

// Teto do query engine do data (`Math.min(limit ?? 50, 500)`): listar centros sem limite explícito
// esconderia os centros mais antigos assim que a fábrica passasse de 50 cadastrados.
const LIMITE = 500

export class ListarCentrosService implements ListarCentros {
  constructor(private readonly store: RecordStore, private readonly registry: EntityRegistry) {}

  // Devolve `nome`/`setor` junto do custo: sem eles a lista é uma parede de ids opacos e o
  // centro recém-criado fica IMPOSSÍVEL de identificar — e o id do centro é justamente o que
  // `definir_operacao` exige como `centroId`.
  async execute(): Promise<CentroView[]> {
    const centrosId = await this.registry.entityIdBySlug('centros_de_trabalho')
    if (!centrosId) return []
    const rows = await this.store.query(centrosId, [], LIMITE)
    return rows.map((r) => ({
      id: r.id,
      nome: String(r.data.nome ?? ''),
      setor: String(r.data.setor ?? ''),
      custoMinMod: r.data.custo_min_mod == null ? null : num(r.data.custo_min_mod),
    }))
  }
}
