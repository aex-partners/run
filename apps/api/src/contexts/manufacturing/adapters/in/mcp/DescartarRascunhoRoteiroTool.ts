import { Json } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { DescartarRascunhoRoteiro } from '@/contexts/manufacturing/application/ports/in/DescartarRascunhoRoteiro'
import { asObject, reqString } from '@/contexts/manufacturing/adapters/in/mcp/manufacturingInput'

// Driving adapter for the AI (Eric). Same in-port the HTTP controller calls; only
// the transport differs. Mutating -> requires confirmation (readOnly: false).
// SAÍDA DE EMERGÊNCIA: apaga TODOS os rascunhos de operação do modelo, sem tocar na revisão
// publicada. Existe para o usuário desistir de uma edição em andamento e recomeçar, ou destravar
// um rascunho parcial (ex.: abrir_revisao_roteiro interrompido no meio) quando a intenção é
// recomeçar do zero em vez de completar (para completar, prefira abrir_revisao_roteiro: ele faz
// top-up sem apagar o que já foi editado).
export const descartarRascunhoRoteiroTool = (uc: DescartarRascunhoRoteiro): ToolDefinition => ({
  name: 'descartar_rascunho_roteiro',
  readOnly: false,
  description:
    'Abandona a revisão do roteiro em aberto: APAGA todos os rascunhos de operação do Modelo. A revisão PUBLICADA não é tocada, então o roteiro que está custeando hoje continua exatamente o mesmo. Input: { modeloId: string }. Use para desistir de uma edição em andamento e recomeçar do zero, ou para destravar um rascunho incompleto (ex.: abrir_revisao_roteiro interrompido no meio) quando a intenção é recomeçar em vez de completar — para completar sem perder o que já foi editado, prefira chamar abrir_revisao_roteiro de novo (ele clona só o que falta). Retorna { descartadas } = quantos rascunhos foram apagados; 0 quando não havia nenhum (não é erro).',
  async execute(input: Json) {
    const obj = asObject('descartar_rascunho_roteiro', input)
    if (!obj.ok) return fail(obj.error)
    const modeloId = reqString('descartar_rascunho_roteiro', obj.value, 'modeloId')
    if (!modeloId.ok) return fail(modeloId.error)
    const r = await uc.execute({ modeloId: modeloId.value })
    return r.ok ? ok({ descartadas: r.value.descartadas }) : fail(r.error)
  },
})
