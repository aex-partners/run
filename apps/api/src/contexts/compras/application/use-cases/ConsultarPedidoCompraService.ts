import { Result, ok, fail } from '@/shared/kernel/Result'
import { EntityRegistry } from '@/contexts/compras/application/ports/out/EntityRegistry'
import { RecordStore } from '@/contexts/compras/application/ports/out/RecordStore'
import { ConsultarPedidoCompra, PedidoView } from '@/contexts/compras/application/ports/in/ConsultarPedidoCompra'
import { ComprasError } from '@/contexts/compras/domain/ComprasError'

const LIMITE = 500
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0)) || 0

export class ConsultarPedidoCompraService implements ConsultarPedidoCompra {
  constructor(private readonly store: RecordStore, private readonly registry: EntityRegistry) {}

  async execute(q: { pedidoId: string }): Promise<Result<PedidoView>> {
    const itensId = await this.registry.entityIdBySlug('itens_pedido_compra')
    if (!itensId) return fail(ComprasError.entidadeFaltando)

    const pedido = await this.store.get(q.pedidoId)
    if (!pedido) return fail(ComprasError.pedidoNaoEncontrado)

    const itens = await this.store.query(itensId, [{ field: 'pedido', op: 'eq', value: q.pedidoId }], LIMITE)

    return ok({
      pedidoId: pedido.id,
      numero: String(pedido.data.numero ?? ''),
      fornecedorId: String(pedido.data.fornecedor ?? ''),
      data: String(pedido.data.data ?? ''),
      status: String(pedido.data.status ?? ''),
      valorTotal: num(pedido.data.valor_total),
      itens: itens.map((i) => ({
        insumoId: String(i.data.insumo ?? ''),
        qtd: num(i.data.qtd),
        precoUnitario: num(i.data.preco_unitario),
        qtdRecebida: num(i.data.qtd_recebida),
      })),
    })
  }
}
