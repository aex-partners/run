import { Result, ok, fail } from '@/shared/kernel/Result'
import { EntityRegistry } from '@/contexts/estoque/application/ports/out/EntityRegistry'
import { RecordStore } from '@/contexts/estoque/application/ports/out/RecordStore'
import { ConsultarSaldo, SaldoView } from '@/contexts/estoque/application/ports/in/ConsultarSaldo'
import { EstoqueError } from '@/contexts/estoque/domain/EstoqueError'

const LIMITE = 500
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0)) || 0

export class ConsultarSaldoService implements ConsultarSaldo {
  constructor(private readonly store: RecordStore, private readonly registry: EntityRegistry) {}

  async execute(q: { insumoId: string }): Promise<Result<SaldoView>> {
    const saldosId = await this.registry.entityIdBySlug('saldos_de_estoque')
    if (!saldosId) return fail(EstoqueError.entidadeFaltando)

    const insumo = await this.store.get(q.insumoId)
    if (!insumo) return fail(EstoqueError.insumoNaoEncontrado)

    const rows = await this.store.query(saldosId, [{ field: 'insumo', op: 'eq', value: q.insumoId }], LIMITE)
    const porDeposito: SaldoView['porDeposito'] = []
    for (const r of rows) {
      const depId = String(r.data.deposito ?? '')
      const dep = depId ? await this.store.get(depId) : null
      porDeposito.push({ depositoId: depId, deposito: String(dep?.data.nome ?? depId), qtd: num(r.data.qtd) })
    }

    return ok({
      insumoId: q.insumoId,
      unidadeConsumo: String(insumo.data.unidade_consumo ?? ''),
      custoMedio: num(insumo.data.custo_medio),
      saldoTotal: num(insumo.data.saldo_total),
      porDeposito,
    })
  }
}
