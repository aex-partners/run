import { Json } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { ExplodirFicha } from '@/contexts/costing/application/ports/in/ExplodirFicha'
import { asObject, reqString } from '@/contexts/costing/adapters/in/mcp/costingInput'

// Driving adapter for the AI (Eric). Same in-port the HTTP controller calls; only
// the transport differs. Mutating -> requires confirmation (readOnly: false).
// Explodes a SKU's ficha técnica: resolves per-size quantities, swaps fantasma
// items for the variação's cor, computes the cost and writes the exploded ficha +
// a cost snapshot. When an entity is missing or the SKU has no published ficha the
// in-port fails with an actionable message, surfaced to Eric verbatim.
export const explodirFichaTool = (uc: ExplodirFicha): ToolDefinition => ({
  name: 'explodir_ficha',
  readOnly: false,
  description:
    'Explode a ficha técnica de um SKU (produto final): resolve quantidades por tamanho, substitui itens fantasma pela cor, calcula o custo e grava a ficha explodida + snapshot. Input: { skuId: string, forcar?: boolean }. forcar=true descarta as linhas editadas manualmente. Retorna { skuId, custoTotal, linhas, erros, manuaisPreservados }.',
  async execute(input: Json) {
    const obj = asObject('explodir_ficha', input)
    if (!obj.ok) return fail(obj.error)
    const skuId = reqString('explodir_ficha', obj.value, 'skuId')
    if (!skuId.ok) return fail(skuId.error)
    const r = await uc.execute({ skuId: skuId.value, forcar: obj.value.forcar === true })
    return r.ok
      ? ok({
          skuId: r.value.skuId,
          custoTotal: r.value.custoTotal,
          linhas: r.value.linhas,
          erros: r.value.erros,
          manuaisPreservados: r.value.manuaisPreservados,
        })
      : fail(r.error)
  },
})
