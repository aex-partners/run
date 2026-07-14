import { Result, ok, fail } from '@/shared/kernel/Result'
import { EntityRegistry } from '@/contexts/estoque/application/ports/out/EntityRegistry'
import { RecordStore } from '@/contexts/estoque/application/ports/out/RecordStore'
import { HistoricoMovimentos, MovimentoView } from '@/contexts/estoque/application/ports/in/HistoricoMovimentos'
import { EstoqueError } from '@/contexts/estoque/domain/EstoqueError'

const TETO = 500
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0)) || 0
const str = (v: unknown): string | null => (v == null || v === '' ? null : String(v))

export class HistoricoMovimentosService implements HistoricoMovimentos {
  constructor(private readonly store: RecordStore, private readonly registry: EntityRegistry) {}

  async execute(q: { insumoId: string; limite?: number }): Promise<Result<{ movimentos: MovimentoView[]; truncado: boolean }>> {
    const movId = await this.registry.entityIdBySlug('movimentos_de_estoque')
    if (!movId) return fail(EstoqueError.entidadeFaltando)

    const limite = Math.min(q.limite ?? TETO, TETO)
    const rows = await this.store.query(movId, [{ field: 'insumo', op: 'eq', value: q.insumoId }], limite)

    // SATURAÇÃO DECLARADA. Bateu no limite = há movimentos MAIS ANTIGOS que não vieram
    // (o engine ordena por created_at DESC). Num livro contábil, truncar calado é como
    // um custo errado passa despercebido.
    const truncado = rows.length >= limite

    return ok({
      truncado,
      movimentos: rows.map((r) => ({
        id: r.id,
        tipo: String(r.data.tipo ?? ''),
        qtd: num(r.data.qtd),
        custoUnitario: num(r.data.custo_unitario),
        data: String(r.data.data ?? ''),
        depositoId: String(r.data.deposito ?? ''),
        origemTipo: str(r.data.origem_tipo),
        origemId: str(r.data.origem_id),
        saldoTotalApos: num(r.data.saldo_total_apos),
        custoMedioApos: num(r.data.custo_medio_apos),
        observacao: str(r.data.observacao),
      })),
    })
  }
}
