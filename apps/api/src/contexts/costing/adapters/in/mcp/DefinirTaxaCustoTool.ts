import { Json } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { DefinirTaxaCusto } from '@/contexts/costing/application/ports/in/DefinirTaxaCusto'
import {
  asObject, reqString, optString, nullableString, reqNumber,
} from '@/contexts/costing/adapters/in/mcp/costingInput'

// Driving adapter for the AI (Eric). Same in-port the HTTP controller calls; only
// the transport differs. Mutating -> requires confirmation (readOnly: false).
// Grava uma taxa de custo VIGENTE a partir de uma data (as taxas são versionadas por
// vigência: definir uma nova NÃO apaga a anterior, o histórico continua explicável).
// A chave é validada pelo in-port; um valor inválido volta com a lista de chaves.
export const definirTaxaCustoTool = (uc: DefinirTaxaCusto): ToolDefinition => ({
  name: 'definir_taxa_custo',
  readOnly: false,
  description:
    'Define uma taxa de custo por minuto usada no custeio da conversão. Input: { chave: "taxa_fixa_min" | "taxa_moi_min" | "taxa_depreciacao_min", valor: number, centroId?: string | null, vigenciaInicio: string (YYYY-MM-DD), vigenciaFim?: string | null }. valor = R$ por MINUTO. centroId ausente/null = taxa global (vale para todos os centros); com centroId a taxa vale só naquele centro. Taxas são versionadas por vigência — definir uma nova não apaga a anterior. vigenciaFim, se informada, não pode ser anterior a vigenciaInicio (a taxa nunca entraria em vigor). Retorna { id }.',
  async execute(input: Json) {
    const obj = asObject('definir_taxa_custo', input)
    if (!obj.ok) return fail(obj.error)
    const chave = reqString('definir_taxa_custo', obj.value, 'chave')
    if (!chave.ok) return fail(chave.error)
    const valor = reqNumber('definir_taxa_custo', obj.value, 'valor')
    if (!valor.ok) return fail(valor.error)
    const centroId = nullableString('definir_taxa_custo', obj.value, 'centroId')
    if (!centroId.ok) return fail(centroId.error)
    const vigenciaInicio = reqString('definir_taxa_custo', obj.value, 'vigenciaInicio')
    if (!vigenciaInicio.ok) return fail(vigenciaInicio.error)
    const vigenciaFim = optString('definir_taxa_custo', obj.value, 'vigenciaFim')
    if (!vigenciaFim.ok) return fail(vigenciaFim.error)

    const r = await uc.execute({
      chave: chave.value,
      valor: valor.value,
      centroId: centroId.value,
      vigenciaInicio: vigenciaInicio.value,
      vigenciaFim: vigenciaFim.value ?? null,
    })
    return r.ok ? ok({ id: r.value.id }) : fail(r.error)
  },
})
