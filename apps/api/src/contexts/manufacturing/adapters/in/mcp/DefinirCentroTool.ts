import { Json } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { DefinirCentro } from '@/contexts/manufacturing/application/ports/in/DefinirCentro'
import {
  asObject, reqString, optString, reqNumber, optNumber, optBoolean,
} from '@/contexts/manufacturing/adapters/in/mcp/manufacturingInput'

// Driving adapter for the AI (Eric). Same in-port the HTTP controller calls; only
// the transport differs. Mutating -> requires confirmation (readOnly: false).
// Cria ou atualiza (quando `id` vem preenchido) um centro de trabalho. O
// `custoMinMod` é o custo por MINUTO de mão de obra direta do centro: é ele que o
// costing usa para custear a conversão, então um valor errado propaga para o custo
// de TODOS os SKUs que passam pelo centro.
export const definirCentroTool = (uc: DefinirCentro): ToolDefinition => ({
  name: 'definir_centro_trabalho',
  readOnly: false,
  description:
    'Cria ou atualiza um centro de trabalho (célula/setor produtivo). Input: { id?: string, nome: string, setor: string, custoMinMod: number, capacidadeMinDia?: number, numOperadores?: number, ativo?: boolean }. Sem id cria; com id atualiza. custoMinMod = custo de mão de obra direta por MINUTO no centro (R$/min) — alimenta o custo de conversão dos SKUs que passam por ele. Retorna { id }.',
  async execute(input: Json) {
    const obj = asObject('definir_centro_trabalho', input)
    if (!obj.ok) return fail(obj.error)
    const id = optString('definir_centro_trabalho', obj.value, 'id')
    if (!id.ok) return fail(id.error)
    const nome = reqString('definir_centro_trabalho', obj.value, 'nome')
    if (!nome.ok) return fail(nome.error)
    const setor = reqString('definir_centro_trabalho', obj.value, 'setor')
    if (!setor.ok) return fail(setor.error)
    const custoMinMod = reqNumber('definir_centro_trabalho', obj.value, 'custoMinMod')
    if (!custoMinMod.ok) return fail(custoMinMod.error)
    const capacidadeMinDia = optNumber('definir_centro_trabalho', obj.value, 'capacidadeMinDia')
    if (!capacidadeMinDia.ok) return fail(capacidadeMinDia.error)
    const numOperadores = optNumber('definir_centro_trabalho', obj.value, 'numOperadores')
    if (!numOperadores.ok) return fail(numOperadores.error)
    const ativo = optBoolean('definir_centro_trabalho', obj.value, 'ativo')
    if (!ativo.ok) return fail(ativo.error)

    const r = await uc.execute({
      id: id.value,
      nome: nome.value,
      setor: setor.value,
      custoMinMod: custoMinMod.value,
      capacidadeMinDia: capacidadeMinDia.value,
      numOperadores: numOperadores.value,
      ativo: ativo.value,
    })
    return r.ok ? ok({ id: r.value.id }) : fail(r.error)
  },
})
