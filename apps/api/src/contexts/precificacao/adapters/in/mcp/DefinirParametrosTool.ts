import { Json } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { DefinirParametros } from '@/contexts/precificacao/application/ports/in/DefinirParametros'
import { asObject, reqPercent, optPercent } from '@/contexts/precificacao/adapters/in/mcp/precificacaoInput'

export const definirParametrosTool = (uc: DefinirParametros): ToolDefinition => ({
  name: 'definir_parametros_preco',
  readOnly: false,
  description:
    'Define os parâmetros GERAIS de precificação (imposto e ISS), aplicados a toda a marcação. ' +
    'Input: { imposto: number, iss?: number }. imposto e iss são FRAÇÃO em [0,1]: 10% é 0,10, não 10. Retorna { id }.',
  async execute(input: Json) {
    const obj = asObject('definir_parametros_preco', input)
    if (!obj.ok) return fail(obj.error)
    const imposto = reqPercent('definir_parametros_preco', obj.value, 'imposto')
    if (!imposto.ok) return fail(imposto.error)
    const iss = optPercent('definir_parametros_preco', obj.value, 'iss')
    if (!iss.ok) return fail(iss.error)

    const r = await uc.execute({ imposto: imposto.value, iss: iss.value })
    return r.ok ? ok({ ...r.value }) : fail(r.error)
  },
})
