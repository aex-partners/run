import { Json } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { PublicarRoteiro } from '@/contexts/manufacturing/application/ports/in/PublicarRoteiro'
import { asObject, reqString } from '@/contexts/manufacturing/adapters/in/mcp/manufacturingInput'

// Driving adapter for the AI (Eric). Same in-port the HTTP controller calls; only
// the transport differs. Mutating -> requires confirmation (readOnly: false).
// Promove os RASCUNHOS de operação do modelo a uma nova revisão publicada. É o
// gatilho que faz a conversão (MOD + indireto) passar a valer no custo: até a
// publicação o costing não enxerga o roteiro. Falha quando não há rascunho.
export const publicarRoteiroTool = (uc: PublicarRoteiro): ToolDefinition => ({
  name: 'publicar_roteiro',
  readOnly: false,
  description:
    'Publica os rascunhos do roteiro de produção de um Modelo como uma nova revisão. Input: { modeloId: string }. A nova revisão é EXATAMENTE o conjunto de rascunhos do modelo: uma revisão é o roteiro COMPLETO, não um delta. Para alterar um roteiro já publicado, chame abrir_revisao_roteiro (que clona a revisão inteira para rascunho), edite os rascunhos e só então publique. Só depois de publicado o roteiro passa a custear a conversão (mão de obra + indireto) nas explosões de ficha. Falha se o modelo não tiver operações em rascunho. Retorna { rev, operacoes } — confira `operacoes` contra o total esperado do roteiro.',
  async execute(input: Json) {
    const obj = asObject('publicar_roteiro', input)
    if (!obj.ok) return fail(obj.error)
    const modeloId = reqString('publicar_roteiro', obj.value, 'modeloId')
    if (!modeloId.ok) return fail(modeloId.error)
    const r = await uc.execute({ modeloId: modeloId.value })
    return r.ok ? ok({ rev: r.value.rev, operacoes: r.value.operacoes }) : fail(r.error)
  },
})
