import { Result, ok, fail } from '@/shared/kernel/Result'
import { EntityRegistry } from '@/contexts/costing/application/ports/out/EntityRegistry'
import { RecordStore, RecordRow } from '@/contexts/costing/application/ports/out/RecordStore'
import { CustosDesatualizados, SkuDefasado } from '@/contexts/costing/application/ports/in/CustosDesatualizados'
import { CostingError } from '@/contexts/costing/domain/CostingError'

// Teto do query engine do data (`Math.min(limit ?? 50, 500)`).
const LIMITE = 500

// Lê `produtos.custo_medio_atualizado_em`, um campo de PRODUTOS (escrito pelo contexto
// `estoque` quando o custo médio muda de valor). Este serviço NÃO lê nenhuma entidade do
// `estoque`: se lesse, o costing passaria a conhecer o schema de outro contexto.
export class CustosDesatualizadosService implements CustosDesatualizados {
  constructor(private readonly store: RecordStore, private readonly registry: EntityRegistry) {}

  async execute(q: { modeloId?: string }): Promise<Result<{ skus: SkuDefasado[]; truncado: boolean }>> {
    const ids = await this.resolveEntities()
    if (!ids) return fail(CostingError.entidadeFaltando)

    let truncado = false
    const saturou = (rows: unknown[]) => { if (rows.length >= LIMITE) truncado = true }

    // 1) os modelos a varrer
    let modeloIds: string[]
    if (q.modeloId) {
      modeloIds = [q.modeloId]
    } else {
      const modelos = await this.store.query(ids.modelos, [], LIMITE)
      saturou(modelos)
      modeloIds = modelos.map((m) => m.id)
    }

    // Cache dos produtos: os SKUs de um modelo compartilham os mesmos insumos, e cada
    // leitura é um `get` por id (a query por `field: 'id'` não existe no engine).
    const produtoCache = new Map<string, RecordRow | null>()
    const produto = async (id: string) => {
      if (!produtoCache.has(id)) produtoCache.set(id, await this.store.get(id))
      return produtoCache.get(id) ?? null
    }

    const out: SkuDefasado[] = []

    for (const modeloId of modeloIds) {
      const skus = await this.store.query(ids.produtos, [{ field: 'modelo', op: 'eq', value: modeloId }], LIMITE)
      saturou(skus)

      for (const sku of skus) {
        // Só SKUs JÁ CUSTEADOS interessam: sem ficha explodida, não há custo para defasar.
        const explodidas = await this.store.query(ids.fichas_explodidas, [{ field: 'sku', op: 'eq', value: sku.id }], LIMITE)
        saturou(explodidas)
        if (explodidas.length === 0) continue

        // O snapshot MAIS RECENTE do SKU. Sem snapshot = custo nunca gravado = defasado.
        const snaps = await this.store.query(ids.snapshots_custo, [{ field: 'sku', op: 'eq', value: sku.id }], LIMITE)
        saturou(snaps)
        const snapshotEm = snaps
          .map((s) => String(s.data.data ?? ''))
          .filter((d) => d !== '')
          .sort()
          .pop() ?? null

        // SEM SNAPSHOT = o custo NUNCA foi gravado. Defasado por definição, independentemente
        // de os insumos terem carimbo ou não. Deixar de fora um SKU cujo custo nunca existiu é
        // o pior silêncio que um sistema de AVISO pode ter: ele foi feito exatamente para isso.
        if (snapshotEm === null) {
          out.push({
            skuId: sku.id,
            modeloId,
            snapshotEm: null,
            insumoAtualizadoEm: '',
            insumos: [...new Set(explodidas.map((e) => String(e.data.item ?? '')).filter(Boolean))],
          })
          continue
        }

        // Os insumos cujo custo médio mudou DEPOIS do snapshot.
        const defasados: string[] = []
        let maisRecente = ''
        for (const itemId of new Set(explodidas.map((e) => String(e.data.item ?? '')).filter(Boolean))) {
          const p = await produto(itemId)
          const em = String(p?.data.custo_medio_atualizado_em ?? '')
          // Sem carimbo = o insumo nunca teve movimento de estoque. Não defasa nada.
          if (em === '') continue
          if (em <= snapshotEm) continue
          defasados.push(itemId)
          if (em > maisRecente) maisRecente = em
        }

        if (defasados.length === 0) continue
        out.push({
          skuId: sku.id,
          modeloId,
          snapshotEm,
          insumoAtualizadoEm: maisRecente,
          insumos: defasados,
        })
      }
    }

    return ok({ skus: out, truncado })
  }

  private async resolveEntities() {
    const slugs = ['modelos', 'produtos', 'fichas_explodidas', 'snapshots_custo'] as const
    const out = {} as Record<(typeof slugs)[number], string>
    for (const s of slugs) {
      const id = await this.registry.entityIdBySlug(s)
      if (!id) return null
      out[s] = id
    }
    return out
  }
}
