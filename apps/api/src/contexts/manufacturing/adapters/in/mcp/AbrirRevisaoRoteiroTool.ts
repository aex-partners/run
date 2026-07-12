import { Json } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { AbrirRevisaoRoteiro } from '@/contexts/manufacturing/application/ports/in/AbrirRevisaoRoteiro'
import { asObject, reqString } from '@/contexts/manufacturing/adapters/in/mcp/manufacturingInput'

// Driving adapter for the AI (Eric). Same in-port the HTTP controller calls; only
// the transport differs. Mutating -> requires confirmation (readOnly: false).
// PORTA DE ENTRADA OBRIGATÓRIA para alterar um roteiro já publicado: clona a revisão
// publicada INTEIRA para rascunho, de modo que o rascunho já nasça completo. Sem isso,
// editar uma operação e publicar criaria uma revisão só com ela e as demais sumiriam do custo.
export const abrirRevisaoRoteiroTool = (uc: AbrirRevisaoRoteiro): ToolDefinition => ({
  name: 'abrir_revisao_roteiro',
  readOnly: false,
  description:
    'Abre uma nova revisão do roteiro de produção de um Modelo, CLONANDO todas as operações da última revisão publicada como rascunhos novos (mesmo codigo, mesmos tempos). Input: { modeloId: string }. É o PRIMEIRO passo obrigatório para alterar um roteiro já publicado: depois disso edite os rascunhos com definir_operacao (operação publicada é imutável) e finalize com publicar_roteiro. Como o rascunho nasce com o roteiro COMPLETO, publicar não perde nenhuma operação. Falha se já houver rascunho aberto para o modelo, ou se o modelo ainda não tiver revisão publicada (nesse caso crie as operações direto com definir_operacao). Retorna { operacoes } = quantas operações foram clonadas.',
  async execute(input: Json) {
    const obj = asObject('abrir_revisao_roteiro', input)
    if (!obj.ok) return fail(obj.error)
    const modeloId = reqString('abrir_revisao_roteiro', obj.value, 'modeloId')
    if (!modeloId.ok) return fail(modeloId.error)
    const r = await uc.execute({ modeloId: modeloId.value })
    return r.ok ? ok({ operacoes: r.value.operacoes }) : fail(r.error)
  },
})
