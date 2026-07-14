import { Result, ok, fail } from '@/shared/kernel/Result'
import { EntityRegistry } from '@/contexts/costing/application/ports/out/EntityRegistry'
import { RecordStore } from '@/contexts/costing/application/ports/out/RecordStore'
import { ExplodirFicha } from '@/contexts/costing/application/ports/in/ExplodirFicha'
import { RecalcularCusto } from '@/contexts/costing/application/ports/in/RecalcularCusto'

// Teto do query engine do data (`Math.min(limit ?? 50, 500)`): sem limite explícito um modelo com
// mais de 50 SKUs teria os mais antigos ignorados no recálculo, sem erro nenhum.
const LIMITE = 500

export class RecalcularCustoService implements RecalcularCusto {
  constructor(private readonly explodir: ExplodirFicha, private readonly store: RecordStore, private readonly registry: EntityRegistry) {}
  async execute(cmd: { skuId?: string; modeloId?: string; skuIds?: string[] }): Promise<Result<{ recalculados: number }>> {
    const skuIds: string[] = []
    if (cmd.skuId) skuIds.push(cmd.skuId)
    else if (cmd.skuIds) {
      // Lista vazia recusada: recalcular zero SKUs e devolver ok({recalculados: 0}) é um
      // no-op que PARECE sucesso — exatamente o que faz o usuário achar que o custo foi
      // atualizado quando não foi.
      if (cmd.skuIds.length === 0) return fail('skuIds vazio: informe ao menos um SKU')
      skuIds.push(...cmd.skuIds)
    } else if (cmd.modeloId) {
      const produtosId = await this.registry.entityIdBySlug('produtos')
      if (!produtosId) return fail('entidade produtos ausente')
      const rows = await this.store.query(produtosId, [{ field: 'modelo', op: 'eq', value: cmd.modeloId }], LIMITE)
      skuIds.push(...rows.map((r) => r.id))
    } else return fail('informe skuId, skuIds ou modeloId')
    let recalculados = 0
    for (const id of skuIds) { const r = await this.explodir.execute({ skuId: id }); if (r.ok) recalculados++ }
    return ok({ recalculados })
  }
}
