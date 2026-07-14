import { Json } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { CriarPedidoCompra } from '@/contexts/compras/application/ports/in/CriarPedidoCompra'
import { asObject, reqString, optString, reqItens } from '@/contexts/compras/adapters/in/mcp/comprasInput'

export const criarPedidoCompraTool = (uc: CriarPedidoCompra): ToolDefinition => ({
  name: 'criar_pedido_compra',
  readOnly: false,
  description:
    'Cria um pedido de compra. NÃO mexe em estoque nem em custo: quem move é a nota (lancar_nota_entrada). ' +
    'Input: { numero: string, fornecedorId: string, data: string, previsaoEntrega?: string, observacao?: string, itens: [{ insumoId, qtd, precoUnitario }] }. ' +
    'qtd e precoUnitario na unidade de COMPRA. Retorna { pedidoId, valorTotal }.',
  async execute(input: Json) {
    const obj = asObject('criar_pedido_compra', input)
    if (!obj.ok) return fail(obj.error)
    const numero = reqString('criar_pedido_compra', obj.value, 'numero')
    if (!numero.ok) return fail(numero.error)
    const fornecedorId = reqString('criar_pedido_compra', obj.value, 'fornecedorId')
    if (!fornecedorId.ok) return fail(fornecedorId.error)
    const data = reqString('criar_pedido_compra', obj.value, 'data')
    if (!data.ok) return fail(data.error)
    const previsaoEntrega = optString('criar_pedido_compra', obj.value, 'previsaoEntrega')
    if (!previsaoEntrega.ok) return fail(previsaoEntrega.error)
    const observacao = optString('criar_pedido_compra', obj.value, 'observacao')
    if (!observacao.ok) return fail(observacao.error)
    const itens = reqItens('criar_pedido_compra', obj.value, 'itens')
    if (!itens.ok) return fail(itens.error)

    const r = await uc.execute({
      numero: numero.value, fornecedorId: fornecedorId.value, data: data.value,
      previsaoEntrega: previsaoEntrega.value, observacao: observacao.value,
      itens: itens.value.map((i) => ({ insumoId: i.insumoId, qtd: i.qtd, precoUnitario: i.precoUnitario })),
    })
    return r.ok ? ok({ ...r.value }) : fail(r.error)
  },
})
