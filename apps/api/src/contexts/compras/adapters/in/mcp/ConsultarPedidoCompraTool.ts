import { Json } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { ConsultarPedidoCompra } from '@/contexts/compras/application/ports/in/ConsultarPedidoCompra'
import { asObject, reqString } from '@/contexts/compras/adapters/in/mcp/comprasInput'

export const consultarPedidoCompraTool = (uc: ConsultarPedidoCompra): ToolDefinition => ({
  name: 'consultar_pedido_compra',
  readOnly: true,
  description:
    'Consulta um pedido de compra e o que já foi recebido dele. Input: { pedidoId: string }. ' +
    'Retorna { pedidoId, numero, fornecedorId, data, status, valorTotal, itens: [{ insumoId, qtd, precoUnitario, qtdRecebida }] }.',
  async execute(input: Json) {
    const obj = asObject('consultar_pedido_compra', input)
    if (!obj.ok) return fail(obj.error)
    const pedidoId = reqString('consultar_pedido_compra', obj.value, 'pedidoId')
    if (!pedidoId.ok) return fail(pedidoId.error)
    const r = await uc.execute({ pedidoId: pedidoId.value })
    return r.ok ? ok({ ...r.value }) : fail(r.error)
  },
})
