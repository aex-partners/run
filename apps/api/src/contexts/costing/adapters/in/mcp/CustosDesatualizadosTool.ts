import { Json } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { CustosDesatualizados } from '@/contexts/costing/application/ports/in/CustosDesatualizados'
import { asObject, optString } from '@/contexts/costing/adapters/in/mcp/costingInput'

// O custo do produto NUNCA muda sozinho. Esta tool é o que evita que ele minta em
// silêncio: acusa os SKUs cujo custo foi calculado ANTES de o custo do insumo mudar.
// Zero escrita. O fluxo do Eric é: custos_desatualizados -> lista -> recalcular_custo({ skuIds }).
export const custosDesatualizadosTool = (uc: CustosDesatualizados): ToolDefinition => ({
  name: 'custos_desatualizados',
  readOnly: true,
  description:
    'Lista os SKUs cujo custo está DEFASADO: o custo foi calculado antes de o custo médio de algum insumo da ficha mudar. ' +
    'Input: { modeloId?: string } (sem modeloId, varre todos os modelos). ' +
    'Retorna { skus: [{ skuId, modeloId, snapshotEm, insumoAtualizadoEm, insumos }], truncado }. ' +
    'truncado=true significa que a consulta bateu no teto do motor e há SKUs defasados que NÃO vieram nesta lista. Informe isso ao usuário. ' +
    'Não altera nada: para atualizar, chame recalcular_custo com os skuIds devolvidos.',
  async execute(input: Json) {
    const obj = asObject('custos_desatualizados', input)
    if (!obj.ok) return fail(obj.error)
    const modeloId = optString('custos_desatualizados', obj.value, 'modeloId')
    if (!modeloId.ok) return fail(modeloId.error)
    const r = await uc.execute({ modeloId: modeloId.value })
    if (!r.ok) return fail(r.error)
    // `.map()` para um objeto literal fresco: `SkuDefasado` é uma interface nomeada, sem
    // assinatura de índice, então não é estruturalmente atribuível a `Json` sem isso.
    return ok({
      skus: r.value.skus.map((s) => ({
        skuId: s.skuId,
        modeloId: s.modeloId,
        snapshotEm: s.snapshotEm,
        insumoAtualizadoEm: s.insumoAtualizadoEm,
        insumos: s.insumos,
      })),
      truncado: r.value.truncado,
    })
  },
})
