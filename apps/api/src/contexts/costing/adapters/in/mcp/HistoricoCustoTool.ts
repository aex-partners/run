import { Json } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { HistoricoCusto } from '@/contexts/costing/application/ports/in/HistoricoCusto'
import { asObject, reqString } from '@/contexts/costing/adapters/in/mcp/costingInput'

// Driving adapter for the AI (Eric). Read-only (readOnly: true) -> auto-executes,
// no confirmation. Returns the SKU's cost snapshots in chronological order. The
// in-port never fails (returns [] when the entity or SKU is absent).
export const historicoCustoTool = (uc: HistoricoCusto): ToolDefinition => ({
  name: 'historico_custo',
  readOnly: true,
  description:
    'Lista o histórico de custo (snapshots) de um SKU, em ordem cronológica. Input: { skuId: string }. Retorna { snapshots: [{ data, custoTotal, origemRev }] }.',
  async execute(input: Json) {
    const obj = asObject('historico_custo', input)
    if (!obj.ok) return fail(obj.error)
    const skuId = reqString('historico_custo', obj.value, 'skuId')
    if (!skuId.ok) return fail(skuId.error)
    const views = await uc.execute({ skuId: skuId.value })
    return ok({
      snapshots: views.map((v) => ({ data: v.data, custoTotal: v.custoTotal, origemRev: v.origemRev })),
    })
  },
})
