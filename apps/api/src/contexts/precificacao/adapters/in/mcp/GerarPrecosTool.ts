import { Json } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { GerarPrecos } from '@/contexts/precificacao/application/ports/in/GerarPrecos'
import { asObject, optString, optStringArray } from '@/contexts/precificacao/adapters/in/mcp/precificacaoInput'

export const gerarPrecosTool = (uc: GerarPrecos): ToolDefinition => ({
  name: 'gerar_precos',
  readOnly: false,
  description:
    'Grava a tabela de preços de venda a partir do custo do SKU + política de precificação (canal, condição financeira, parâmetros gerais e lucro-alvo). ' +
    'Input: { skuId?: string, modeloId?: string, skuIds?: string[] } (sem nenhum, gera para todos os SKUs com custo). ' +
    'NÃO recalcula custo: usa o custo mais recente já publicado. SKU sem custo publicado é PULADO, não gera erro. ' +
    'Retorna { gravados, erros }. erros traz avisos SUAVES por SKU (ex.: falha ao gravar uma linha de preço); os preços gravados com sucesso permanecem válidos. SEMPRE mostre os erros ao usuário.',
  async execute(input: Json) {
    const obj = asObject('gerar_precos', input)
    if (!obj.ok) return fail(obj.error)
    const skuId = optString('gerar_precos', obj.value, 'skuId')
    if (!skuId.ok) return fail(skuId.error)
    const modeloId = optString('gerar_precos', obj.value, 'modeloId')
    if (!modeloId.ok) return fail(modeloId.error)
    const skuIds = optStringArray('gerar_precos', obj.value, 'skuIds')
    if (!skuIds.ok) return fail(skuIds.error)

    const r = await uc.execute({ skuId: skuId.value, modeloId: modeloId.value, skuIds: skuIds.value })
    return r.ok ? ok({ ...r.value }) : fail(r.error)
  },
})
