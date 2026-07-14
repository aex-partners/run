import { Result, ok, fail } from '@/shared/kernel/Result'
import { EntityRegistry } from '@/contexts/compras/application/ports/out/EntityRegistry'
import { RecordStore } from '@/contexts/compras/application/ports/out/RecordStore'
import { CriarPedidoCompra, CriarPedidoCompraCommand } from '@/contexts/compras/application/ports/in/CriarPedidoCompra'
import { ComprasError } from '@/contexts/compras/domain/ComprasError'

export class CriarPedidoCompraService implements CriarPedidoCompra {
  constructor(private readonly store: RecordStore, private readonly registry: EntityRegistry) {}

  async execute(cmd: CriarPedidoCompraCommand): Promise<Result<{ pedidoId: string; valorTotal: number }>> {
    const pedidosId = await this.registry.entityIdBySlug('pedidos_de_compra')
    const itensId = await this.registry.entityIdBySlug('itens_pedido_compra')
    if (!pedidosId || !itensId) return fail(ComprasError.entidadeFaltando)

    if (cmd.itens.length === 0) return fail(ComprasError.pedidoSemItens)

    // Valida os insumos ANTES de gravar: um item pendurado num pedido é um erro que só
    // aparece na hora de lançar a nota, quando é caro consertar.
    for (const i of cmd.itens) {
      if (!(await this.store.get(i.insumoId))) return fail(ComprasError.insumoNaoEncontrado(i.insumoId))
    }

    const valorTotal = cmd.itens.reduce((s, i) => s + i.qtd * i.precoUnitario, 0)

    const pedidoId = await this.store.insert(pedidosId, {
      numero: cmd.numero,
      fornecedor: cmd.fornecedorId,
      data: cmd.data,
      previsao_entrega: cmd.previsaoEntrega ?? null,
      status: 'enviado',
      valor_total: valorTotal,
      observacao: cmd.observacao ?? null,
    })

    for (const i of cmd.itens) {
      await this.store.insert(itensId, {
        pedido: pedidoId,
        insumo: i.insumoId,
        qtd: i.qtd,
        preco_unitario: i.precoUnitario,
        // Alimentada pelo motor da nota, a cada entrada lançada contra este pedido.
        qtd_recebida: 0,
      })
    }

    return ok({ pedidoId, valorTotal })
  }
}
