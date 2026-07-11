import { EntityRegistry } from '@/contexts/costing/application/ports/out/EntityRegistry'
import { RecordStore } from '@/contexts/costing/application/ports/out/RecordStore'
import { CustoUnitario, CustoUnitarioView } from '@/contexts/costing/application/ports/in/CustoUnitario'

// Teto do query engine do data (`Math.min(limit ?? 50, 500)`): sem limite explícito o snapshot
// MAIS RECENTE poderia cair fora das 50 linhas devolvidas (ordenadas por created_at DESC, mas
// sem garantia de ordenação por `data`) e o "último" calculado aqui estaria errado em silêncio.
const LIMITE = 500

// LÊ o snapshot gravado, NUNCA recalcula: o histórico de custo é imutável e se explica por si.
export class CustoUnitarioService implements CustoUnitario {
  constructor(private readonly store: RecordStore, private readonly registry: EntityRegistry) {}
  async execute(q: { skuId: string }): Promise<CustoUnitarioView | null> {
    const id = await this.registry.entityIdBySlug('snapshots_custo')
    if (!id) return null
    const rows = await this.store.query(id, [{ field: 'sku', op: 'eq', value: q.skuId }], LIMITE)
    if (rows.length === 0) return null
    const n = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0)) || 0
    const ultimo = rows.sort((a, b) => String(a.data.data ?? '').localeCompare(String(b.data.data ?? ''))).at(-1)!
    return {
      skuId: q.skuId,
      data: String(ultimo.data.data ?? ''),
      custoMateriais: n(ultimo.data.custo_materiais),
      custoMod: n(ultimo.data.custo_mod),
      custoIndireto: n(ultimo.data.custo_indireto),
      custoTotal: n(ultimo.data.custo_total),
      tempoTotalMin: n(ultimo.data.tempo_total_min),
      origemRevRoteiro: n(ultimo.data.origem_rev_roteiro),
    }
  }
}
