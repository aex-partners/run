import { Result, ok, fail } from '@/shared/kernel/Result'
import { EntityRegistry } from '@/contexts/precificacao/application/ports/out/EntityRegistry'
import { RecordStore } from '@/contexts/precificacao/application/ports/out/RecordStore'
import { ConsultarPreco, PrecoLinha } from '@/contexts/precificacao/application/ports/in/ConsultarPreco'
import { PrecificacaoError } from '@/contexts/precificacao/domain/PrecificacaoError'

const LIMITE = 500
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0)) || 0

export class ConsultarPrecoService implements ConsultarPreco {
  constructor(private readonly store: RecordStore, private readonly registry: EntityRegistry) {}
  async execute(q: { skuId: string }): Promise<Result<{ skuId: string; custoBase: number; precos: PrecoLinha[] }>> {
    const precosId = await this.registry.entityIdBySlug('precos_de_venda')
    if (!precosId) return fail(PrecificacaoError.entidadeFaltando)
    const rows = await this.store.query(precosId, [{ field: 'sku', op: 'eq', value: q.skuId }], LIMITE)
    const precos: PrecoLinha[] = rows.map((r) => ({
      canal: String(r.data.canal ?? ''), condicao: String(r.data.condicao ?? ''),
      preco: num(r.data.preco), lucroUsado: num(r.data.lucro_usado),
    }))
    const custoBase = rows.length ? num(rows[0]!.data.custo_base) : 0
    return ok({ skuId: q.skuId, custoBase, precos })
  }
}
