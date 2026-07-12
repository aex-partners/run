import { Json } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { PublicarRoteiro } from '@/contexts/manufacturing/application/ports/in/PublicarRoteiro'
import { asObject, reqString, optBoolean } from '@/contexts/manufacturing/adapters/in/mcp/manufacturingInput'

// Driving adapter for the AI (Eric). Same in-port the HTTP controller calls; only
// the transport differs. Mutating -> requires confirmation (readOnly: false).
// Promove os RASCUNHOS de operação do modelo a uma nova revisão publicada. É o
// gatilho que faz a conversão (MOD + indireto) passar a valer no custo: até a
// publicação o costing não enxerga o roteiro. Falha quando não há rascunho, e
// falha (nomeando o que falta) quando o rascunho não contém o roteiro publicado
// INTEIRO — publicar um conjunto incompleto apagaria operações do custo em silêncio.
export const publicarRoteiroTool = (uc: PublicarRoteiro): ToolDefinition => ({
  name: 'publicar_roteiro',
  readOnly: false,
  description:
    'Publica os rascunhos do roteiro de produção de um Modelo como uma nova revisão. Input: { modeloId: string, substituirTudo?: boolean }. A nova revisão é EXATAMENTE o conjunto de rascunhos do modelo: uma revisão é o roteiro COMPLETO, não um delta. Por isso a publicação FALHA (nomeando os códigos que faltam) se o rascunho não contiver todas as operações da revisão publicada — inclusive quando você só quis ADICIONAR uma operação nova: publicar deixaria a revisão com apenas ela e as demais sumiriam do custo. Para alterar OU adicionar operações num roteiro já publicado, chame abrir_revisao_roteiro (que clona a revisão inteira para rascunho), edite/adicione rascunhos com definir_operacao e só então publique. Use substituirTudo: true APENAS quando a intenção for substituir o roteiro inteiro (ex.: refinar uma operação agregada em várias finas, descartando a agregada). Só depois de publicado o roteiro passa a custear a conversão (mão de obra + indireto) nas explosões de ficha. Retorna { rev, operacoes } — confira `operacoes` contra o total esperado do roteiro.',
  async execute(input: Json) {
    const obj = asObject('publicar_roteiro', input)
    if (!obj.ok) return fail(obj.error)
    const modeloId = reqString('publicar_roteiro', obj.value, 'modeloId')
    if (!modeloId.ok) return fail(modeloId.error)
    const substituirTudo = optBoolean('publicar_roteiro', obj.value, 'substituirTudo')
    if (!substituirTudo.ok) return fail(substituirTudo.error)
    const r = await uc.execute({ modeloId: modeloId.value, substituirTudo: substituirTudo.value })
    return r.ok ? ok({ rev: r.value.rev, operacoes: r.value.operacoes }) : fail(r.error)
  },
})
