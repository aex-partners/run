import { Json } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { LancarNotaEntrada } from '@/contexts/compras/application/ports/in/LancarNotaEntrada'
import { asObject, reqString, optString, nullableString, optNumber, reqItens } from '@/contexts/compras/adapters/in/mcp/comprasInput'

// A NOTA É QUEM RECEBE: lançá-la move o estoque E define o custo médio do insumo. Não
// recalcula ficha nenhuma: o custo do PRODUTO só muda por recalcular_custo.
export const lancarNotaEntradaTool = (uc: LancarNotaEntrada): ToolDefinition => ({
  name: 'lancar_nota_entrada',
  readOnly: false,
  description:
    'Lança a nota de entrada do fornecedor: MOVE O ESTOQUE e define o custo médio dos insumos. ' +
    'Input: { numero: string, serie?: string, fornecedorId: string, pedidoId?: string|null, dataEmissao: string, dataEntrada: string, depositoId: string, valorFrete?: number, condicaoPagamento?: string, chaveNfe?: string, itens: [{ insumoId, qtd, precoUnitario, desconto?, imposto? }] }. ' +
    'qtd e precoUnitario na unidade de COMPRA (o motor converte para a unidade de consumo pelo fator_conversao do produto). ' +
    'pedidoId é opcional: compra direta, sem pedido, é aceita. O frete é rateado entre os itens conforme a política de custo. ' +
    'NÃO recalcula o custo dos produtos: para isso, use custos_desatualizados e depois recalcular_custo. ' +
    'Retorna { notaId, valorTotal, itens: [{ insumoId, qtdCompra, qtdConsumo, freteRateado, custoUnitarioFinal, custoMedioApos }], avisos: string[] }. ' +
    'avisos traz problemas SUAVES: a nota FOI lançada (o estoque moveu), mas algo merece atenção (um item que não estava no pedido, uma quantidade acima da pedida, ou um erro suave devolvido pelo estoque, como uma projeção de custo que falhou). SEMPRE mostre os avisos ao usuário.',
  async execute(input: Json) {
    const obj = asObject('lancar_nota_entrada', input)
    if (!obj.ok) return fail(obj.error)
    const numero = reqString('lancar_nota_entrada', obj.value, 'numero')
    if (!numero.ok) return fail(numero.error)
    const serie = optString('lancar_nota_entrada', obj.value, 'serie')
    if (!serie.ok) return fail(serie.error)
    const fornecedorId = reqString('lancar_nota_entrada', obj.value, 'fornecedorId')
    if (!fornecedorId.ok) return fail(fornecedorId.error)
    const pedidoId = nullableString('lancar_nota_entrada', obj.value, 'pedidoId')
    if (!pedidoId.ok) return fail(pedidoId.error)
    const dataEmissao = reqString('lancar_nota_entrada', obj.value, 'dataEmissao')
    if (!dataEmissao.ok) return fail(dataEmissao.error)
    const dataEntrada = reqString('lancar_nota_entrada', obj.value, 'dataEntrada')
    if (!dataEntrada.ok) return fail(dataEntrada.error)
    const depositoId = reqString('lancar_nota_entrada', obj.value, 'depositoId')
    if (!depositoId.ok) return fail(depositoId.error)
    const valorFrete = optNumber('lancar_nota_entrada', obj.value, 'valorFrete')
    if (!valorFrete.ok) return fail(valorFrete.error)
    const condicaoPagamento = optString('lancar_nota_entrada', obj.value, 'condicaoPagamento')
    if (!condicaoPagamento.ok) return fail(condicaoPagamento.error)
    const chaveNfe = optString('lancar_nota_entrada', obj.value, 'chaveNfe')
    if (!chaveNfe.ok) return fail(chaveNfe.error)
    const itens = reqItens('lancar_nota_entrada', obj.value, 'itens')
    if (!itens.ok) return fail(itens.error)

    const r = await uc.execute({
      numero: numero.value, serie: serie.value, fornecedorId: fornecedorId.value,
      pedidoId: pedidoId.value, dataEmissao: dataEmissao.value, dataEntrada: dataEntrada.value,
      depositoId: depositoId.value, valorFrete: valorFrete.value,
      condicaoPagamento: condicaoPagamento.value, chaveNfe: chaveNfe.value,
      itens: itens.value,
    })
    return r.ok ? ok({ ...r.value }) : fail(r.error)
  },
})
