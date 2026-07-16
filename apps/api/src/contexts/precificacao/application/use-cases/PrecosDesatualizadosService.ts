import { Result, ok, fail } from '@/shared/kernel/Result'
import { EntityRegistry } from '@/contexts/precificacao/application/ports/out/EntityRegistry'
import { RecordStore } from '@/contexts/precificacao/application/ports/out/RecordStore'
import { PrecosDesatualizados, PrecoDefasado } from '@/contexts/precificacao/application/ports/in/PrecosDesatualizados'
import { PrecificacaoError } from '@/contexts/precificacao/domain/PrecificacaoError'

const LIMITE = 500
const ultimaData = (rows: { data: Record<string, unknown> }[]): string | null =>
  rows.map((r) => String(r.data.data ?? '')).filter((d) => d !== '').sort().pop() ?? null

export class PrecosDesatualizadosService implements PrecosDesatualizados {
  constructor(private readonly store: RecordStore, private readonly registry: EntityRegistry) {}
  async execute(q: { modeloId?: string }): Promise<Result<{ skus: PrecoDefasado[]; truncado: boolean }>> {
    const ids = await this.resolveEntities()
    if (!ids) return fail(PrecificacaoError.entidadeFaltando)
    let truncado = false
    const saturou = (rows: unknown[]) => { if (rows.length >= LIMITE) truncado = true }

    let modeloIds: string[]
    if (q.modeloId) modeloIds = [q.modeloId]
    else { const ms = await this.store.query(ids.modelos, [], LIMITE); saturou(ms); modeloIds = ms.map((m) => m.id) }

    const out: PrecoDefasado[] = []
    for (const modeloId of modeloIds) {
      const skus = await this.store.query(ids.produtos, [{ field: 'modelo', op: 'eq', value: modeloId }], LIMITE)
      saturou(skus)
      for (const sku of skus) {
        // Só SKUs COM custo (snapshot) entram. Sem custo, não há o que defasar.
        const snaps = await this.store.query(ids.snapshots, [{ field: 'sku', op: 'eq', value: sku.id }], LIMITE)
        saturou(snaps)
        const custoEm = ultimaData(snaps)
        if (custoEm === null) continue
        const precos = await this.store.query(ids.precos, [{ field: 'sku', op: 'eq', value: sku.id }], LIMITE)
        saturou(precos)
        const precoEm = ultimaData(precos)
        // preço nunca gerado (null) OU preço mais velho que o custo -> defasado
        if (precoEm === null || precoEm < custoEm) out.push({ skuId: sku.id, modeloId, precoEm, custoEm })
      }
    }
    return ok({ skus: out, truncado })
  }

  private async resolveEntities() {
    const slugs = ['modelos', 'produtos', 'snapshots_custo', 'precos_de_venda'] as const
    const out = {} as Record<'modelos'|'produtos'|'snapshots'|'precos', string>
    const map: Record<typeof slugs[number], keyof typeof out> = { modelos: 'modelos', produtos: 'produtos', snapshots_custo: 'snapshots', precos_de_venda: 'precos' }
    for (const s of slugs) { const id = await this.registry.entityIdBySlug(s); if (!id) return null; out[map[s]] = id }
    return out
  }
}
