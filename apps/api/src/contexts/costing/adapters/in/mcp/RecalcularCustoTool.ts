import { Json } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { RecalcularCusto } from '@/contexts/costing/application/ports/in/RecalcularCusto'
import { asObject, optString, optStringArray } from '@/contexts/costing/adapters/in/mcp/costingInput'

// Driving adapter for the AI (Eric). Same in-port the HTTP controller calls; only
// the transport differs. Mutating -> requires confirmation (readOnly: false).
// Re-explodes the ficha of one SKU (skuId) or of every SKU of a modelo (modeloId),
// refreshing their costs. The in-port fails when neither is given.
export const recalcularCustoTool = (uc: RecalcularCusto): ToolDefinition => ({
  name: 'recalcular_custo',
  readOnly: false,
  description:
    'Recalcula o custo re-explodindo a(s) ficha(s): skuId para um SKU, modeloId para todos os SKUs de um modelo, ou skuIds para uma lista (o retorno de custos_desatualizados). ' +
    'Input: { skuId?: string, modeloId?: string, skuIds?: string[] }. É o ÚNICO jeito de o custo de um produto mudar: nada recalcula sozinho. Retorna { recalculados }.',
  async execute(input: Json) {
    const obj = asObject('recalcular_custo', input)
    if (!obj.ok) return fail(obj.error)
    const skuId = optString('recalcular_custo', obj.value, 'skuId')
    if (!skuId.ok) return fail(skuId.error)
    const modeloId = optString('recalcular_custo', obj.value, 'modeloId')
    if (!modeloId.ok) return fail(modeloId.error)
    const skuIds = optStringArray('recalcular_custo', obj.value, 'skuIds')
    if (!skuIds.ok) return fail(skuIds.error)
    const r = await uc.execute({ skuId: skuId.value, modeloId: modeloId.value, skuIds: skuIds.value })
    return r.ok ? ok({ recalculados: r.value.recalculados }) : fail(r.error)
  },
})
