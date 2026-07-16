import { Json } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { ConsultarPreco } from '@/contexts/precificacao/application/ports/in/ConsultarPreco'
import { asObject, reqString } from '@/contexts/precificacao/adapters/in/mcp/precificacaoInput'

export const consultarPrecoTool = (uc: ConsultarPreco): ToolDefinition => ({
  name: 'consultar_preco',
  readOnly: true,
  description:
    'Consulta o preço de venda vigente de um SKU em cada canal/condição financeira. Input: { skuId: string }. ' +
    'Retorna { skuId, custoBase, precos: [{ canal, condicao, preco, lucroUsado }] }. Não altera nada; para atualizar, use gerar_precos.',
  async execute(input: Json) {
    const obj = asObject('consultar_preco', input)
    if (!obj.ok) return fail(obj.error)
    const skuId = reqString('consultar_preco', obj.value, 'skuId')
    if (!skuId.ok) return fail(skuId.error)

    const r = await uc.execute({ skuId: skuId.value })
    if (!r.ok) return fail(r.error)
    // `.map()` para um objeto literal fresco: `PrecoLinha` é uma interface nomeada, sem
    // assinatura de índice, então não é estruturalmente atribuível a `Json` sem isso.
    return ok({
      skuId: r.value.skuId,
      custoBase: r.value.custoBase,
      precos: r.value.precos.map((p) => ({
        canal: p.canal,
        condicao: p.condicao,
        preco: p.preco,
        lucroUsado: p.lucroUsado,
      })),
    })
  },
})
