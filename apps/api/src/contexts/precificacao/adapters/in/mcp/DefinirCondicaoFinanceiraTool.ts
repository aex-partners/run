import { Json } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { DefinirCondicaoFinanceira } from '@/contexts/precificacao/application/ports/in/DefinirCondicaoFinanceira'
import { asObject, reqString, reqPercent } from '@/contexts/precificacao/adapters/in/mcp/precificacaoInput'

export const definirCondicaoFinanceiraTool = (uc: DefinirCondicaoFinanceira): ToolDefinition => ({
  name: 'definir_condicao_financeira',
  readOnly: false,
  description:
    'Cria ou atualiza uma condição financeira de recebimento (ex.: à vista, 30 dias, cartão parcelado). ' +
    'Input: { condicaoId: string, despFinanceira: number }. despFinanceira é FRAÇÃO em [0,1]: à vista é 0, 30 dias costuma ser 0,02 (2%). Retorna { id }.',
  async execute(input: Json) {
    const obj = asObject('definir_condicao_financeira', input)
    if (!obj.ok) return fail(obj.error)
    const condicaoId = reqString('definir_condicao_financeira', obj.value, 'condicaoId')
    if (!condicaoId.ok) return fail(condicaoId.error)
    const despFinanceira = reqPercent('definir_condicao_financeira', obj.value, 'despFinanceira')
    if (!despFinanceira.ok) return fail(despFinanceira.error)

    const r = await uc.execute({ condicaoId: condicaoId.value, despFinanceira: despFinanceira.value })
    return r.ok ? ok({ ...r.value }) : fail(r.error)
  },
})
