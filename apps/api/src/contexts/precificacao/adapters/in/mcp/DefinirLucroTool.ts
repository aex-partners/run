import { Json } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { DefinirLucro } from '@/contexts/precificacao/application/ports/in/DefinirLucro'
import { asObject, reqString, reqPercent } from '@/contexts/precificacao/adapters/in/mcp/precificacaoInput'

export const definirLucroTool = (uc: DefinirLucro): ToolDefinition => ({
  name: 'definir_lucro',
  readOnly: false,
  description:
    'Define o lucro-alvo de um modelo em um canal de venda. Input: { modeloId: string, canalId: string, lucroAlvo: number }. ' +
    'lucroAlvo é FRAÇÃO em [0,1]: 10% é 0,10, não 10. O lucro é definido por modelo × canal; TODOS os SKUs do modelo herdam esse lucro-alvo naquele canal. Retorna { id }.',
  async execute(input: Json) {
    const obj = asObject('definir_lucro', input)
    if (!obj.ok) return fail(obj.error)
    const modeloId = reqString('definir_lucro', obj.value, 'modeloId')
    if (!modeloId.ok) return fail(modeloId.error)
    const canalId = reqString('definir_lucro', obj.value, 'canalId')
    if (!canalId.ok) return fail(canalId.error)
    const lucroAlvo = reqPercent('definir_lucro', obj.value, 'lucroAlvo')
    if (!lucroAlvo.ok) return fail(lucroAlvo.error)

    const r = await uc.execute({ modeloId: modeloId.value, canalId: canalId.value, lucroAlvo: lucroAlvo.value })
    return r.ok ? ok({ ...r.value }) : fail(r.error)
  },
})
