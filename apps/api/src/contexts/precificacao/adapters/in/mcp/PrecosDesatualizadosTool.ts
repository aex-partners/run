import { Json } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { PrecosDesatualizados } from '@/contexts/precificacao/application/ports/in/PrecosDesatualizados'
import { asObject, optString } from '@/contexts/precificacao/adapters/in/mcp/precificacaoInput'

export const precosDesatualizadosTool = (uc: PrecosDesatualizados): ToolDefinition => ({
  name: 'precos_desatualizados',
  readOnly: true,
  description:
    'Lista os SKUs cujo preço é mais VELHO que o custo (o custo mudou depois de o preço ter sido gerado). Input: { modeloId?: string } (sem modeloId, varre todos os modelos). ' +
    'Retorna { skus: [{ skuId, modeloId, precoEm, custoEm }], truncado }. truncado=true significa que a consulta bateu no teto do motor e há SKUs desatualizados que NÃO vieram nesta lista. Informe isso ao usuário. ' +
    'Não altera nada: para atualizar, gere os preços de novo com gerar_precos.',
  async execute(input: Json) {
    const obj = asObject('precos_desatualizados', input)
    if (!obj.ok) return fail(obj.error)
    const modeloId = optString('precos_desatualizados', obj.value, 'modeloId')
    if (!modeloId.ok) return fail(modeloId.error)

    const r = await uc.execute({ modeloId: modeloId.value })
    if (!r.ok) return fail(r.error)
    // `.map()` para um objeto literal fresco: `PrecoDefasado` é uma interface nomeada,
    // sem assinatura de índice, então não é estruturalmente atribuível a `Json` sem isso.
    return ok({
      skus: r.value.skus.map((s) => ({
        skuId: s.skuId,
        modeloId: s.modeloId,
        precoEm: s.precoEm,
        custoEm: s.custoEm,
      })),
      truncado: r.value.truncado,
    })
  },
})
