import { Json } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { CustoUnitario } from '@/contexts/costing/application/ports/in/CustoUnitario'
import { asObject, reqString } from '@/contexts/costing/adapters/in/mcp/costingInput'

// Driving adapter for the AI (Eric). Read-only (readOnly: true) -> auto-executes,
// no confirmation. LÊ o último snapshot gravado (nunca recalcula) e devolve o custo
// unitário ABERTO: materiais + MOD + indireto. Snapshot ausente -> { custo: null }
// (o SKU nunca foi explodido), não é erro.
export const custoUnitarioTool = (uc: CustoUnitario): ToolDefinition => ({
  name: 'custo_unitario',
  readOnly: true,
  description:
    'Consulta o custo unitário CHEIO e aberto do último snapshot de um SKU (leitura pura: não recalcula). Input: { skuId: string }. Retorna { custo: { skuId, data, custoMateriais, custoMod, custoIndireto, custoTotal, tempoTotalMin, origemRevRoteiro } | null }. custoTotal = custoMateriais + custoMod + custoIndireto. custo null = o SKU ainda não foi explodido (use explodir_ficha). Para recalcular, use recalcular_custo.',
  async execute(input: Json) {
    const obj = asObject('custo_unitario', input)
    if (!obj.ok) return fail(obj.error)
    const skuId = reqString('custo_unitario', obj.value, 'skuId')
    if (!skuId.ok) return fail(skuId.error)
    const view = await uc.execute({ skuId: skuId.value })
    if (!view) return ok({ custo: null })
    return ok({
      custo: {
        skuId: view.skuId,
        data: view.data,
        custoMateriais: view.custoMateriais,
        custoMod: view.custoMod,
        custoIndireto: view.custoIndireto,
        custoTotal: view.custoTotal,
        tempoTotalMin: view.tempoTotalMin,
        origemRevRoteiro: view.origemRevRoteiro,
      },
    })
  },
})
