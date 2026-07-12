import { Json } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { AbrirRevisaoRoteiro } from '@/contexts/manufacturing/application/ports/in/AbrirRevisaoRoteiro'
import { asObject, reqString } from '@/contexts/manufacturing/adapters/in/mcp/manufacturingInput'

// Driving adapter for the AI (Eric). Same in-port the HTTP controller calls; only
// the transport differs. Mutating -> requires confirmation (readOnly: false).
// PORTA DE ENTRADA OBRIGATÓRIA para alterar um roteiro já publicado: clona da revisão
// publicada, para rascunho, SÓ o que ainda falta no rascunho atual, de modo que o rascunho
// termine completo. Sem isso, editar uma operação e publicar criaria uma revisão só com ela e
// as demais sumiriam do custo. TOP-UP IDEMPOTENTE: chamar de novo é sempre seguro — completa o
// que falta (inclusive um rascunho PARCIAL deixado por uma chamada anterior interrompida) sem
// jamais sobrescrever/duplicar um rascunho já existente, então uma edição em andamento não é
// perdida.
export const abrirRevisaoRoteiroTool = (uc: AbrirRevisaoRoteiro): ToolDefinition => ({
  name: 'abrir_revisao_roteiro',
  readOnly: false,
  description:
    'Abre (ou COMPLEMENTA) a revisão em rascunho do roteiro de produção de um Modelo, clonando da última revisão publicada SÓ as operações cujo codigo ainda falta no rascunho atual (mesmo codigo, mesmos tempos). Input: { modeloId: string }. É o PRIMEIRO passo para alterar OU ADICIONAR operações num roteiro já publicado: depois disso edite os rascunhos com definir_operacao (operação publicada é imutável) e/ou crie operações NOVAS (definir_operacao sem id), e finalize com publicar_roteiro. TOP-UP IDEMPOTENTE, não falha se já houver rascunho: chamar de novo é sempre seguro, inclusive para curar um rascunho PARCIAL (ex.: uma chamada anterior interrompida no meio) — completa só o que falta e NUNCA sobrescreve nem duplica um rascunho já existente, então uma edição em andamento sobrevive. Falha apenas se o modelo ainda não tiver revisão publicada (nesse caso crie as operações direto com definir_operacao). Retorna { operacoes, complementadas }: operacoes = total de rascunhos do modelo depois da chamada; complementadas = quantos foram clonados NESTA chamada (0 quando o rascunho já estava completo — não é erro).',
  async execute(input: Json) {
    const obj = asObject('abrir_revisao_roteiro', input)
    if (!obj.ok) return fail(obj.error)
    const modeloId = reqString('abrir_revisao_roteiro', obj.value, 'modeloId')
    if (!modeloId.ok) return fail(modeloId.error)
    const r = await uc.execute({ modeloId: modeloId.value })
    return r.ok ? ok({ operacoes: r.value.operacoes, complementadas: r.value.complementadas }) : fail(r.error)
  },
})
