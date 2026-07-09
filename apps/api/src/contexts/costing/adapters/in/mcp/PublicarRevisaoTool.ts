import { Json } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { PublicarRevisao } from '@/contexts/costing/application/ports/in/PublicarRevisao'
import { asObject, reqString } from '@/contexts/costing/adapters/in/mcp/costingInput'

// Driving adapter for the AI (Eric). Same in-port the HTTP controller calls; only
// the transport differs. Mutating -> requires confirmation (readOnly: false).
// Publishes the draft (rascunho) ficha lines of a modelo as the next revision,
// bumping the published rev. Fails when there is nothing to publish.
export const publicarRevisaoTool = (uc: PublicarRevisao): ToolDefinition => ({
  name: 'publicar_revisao_ficha',
  readOnly: false,
  description:
    'Publica os rascunhos da ficha técnica de um modelo como a próxima revisão (incrementa o rev publicado). Input: { modeloId: string }. Retorna { rev }.',
  async execute(input: Json) {
    const obj = asObject('publicar_revisao_ficha', input)
    if (!obj.ok) return fail(obj.error)
    const modeloId = reqString('publicar_revisao_ficha', obj.value, 'modeloId')
    if (!modeloId.ok) return fail(modeloId.error)
    const r = await uc.execute({ modeloId: modeloId.value })
    return r.ok ? ok({ rev: r.value.rev }) : fail(r.error)
  },
})
