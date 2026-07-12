import { Json } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { DefinirOperacao } from '@/contexts/manufacturing/application/ports/in/DefinirOperacao'
import {
  asObject, reqString, optString, nullableString, reqNumber, optNumber, optBoolean, optNumberMap,
} from '@/contexts/manufacturing/adapters/in/mcp/manufacturingInput'

// Driving adapter for the AI (Eric). Same in-port the HTTP controller calls; only
// the transport differs. Mutating -> requires confirmation (readOnly: false).
// Cria/atualiza uma operação do roteiro de um modelo. A operação nasce SEMPRE como
// RASCUNHO: só entra no custo depois de `publicar_roteiro`. Tempos em MINUTOS.
// Atualizar só vale para RASCUNHO: operação publicada é imutável (use abrir_revisao_roteiro).
export const definirOperacaoTool = (uc: DefinirOperacao): ToolDefinition => ({
  name: 'definir_operacao',
  readOnly: false,
  description:
    'Cria ou atualiza uma operação do roteiro de produção de um Modelo (rascunho). Input: { id?: string, modeloId: string, codigo: string, seq: number, nome: string, centroId: string | null, tempoPadraoMin: number, tempoPorTamanho?: { [tamanho: string]: number }, tempoSetupMin?: number, loteSetup?: number, agregada?: boolean }. Sem id cria; com id atualiza (SÓ rascunho: operação já publicada é imutável — chame abrir_revisao_roteiro antes e edite o rascunho clonado). codigo = identidade ESTÁVEL da operação no modelo (ex.: CORTE, COSTURA, ACABAMENTO), preservada em todas as revisões; é por ele que a linha da ficha técnica (operacao_codigo) diz qual operação consome cada insumo. Todos os tempos em MINUTOS. tempoPorTamanho sobrepõe tempoPadraoMin para os tamanhos informados. A operação fica em RASCUNHO e só passa a custear depois de publicar_roteiro. Retorna { id }.',
  async execute(input: Json) {
    const obj = asObject('definir_operacao', input)
    if (!obj.ok) return fail(obj.error)
    const id = optString('definir_operacao', obj.value, 'id')
    if (!id.ok) return fail(id.error)
    const modeloId = reqString('definir_operacao', obj.value, 'modeloId')
    if (!modeloId.ok) return fail(modeloId.error)
    const codigo = reqString('definir_operacao', obj.value, 'codigo')
    if (!codigo.ok) return fail(codigo.error)
    const seq = reqNumber('definir_operacao', obj.value, 'seq')
    if (!seq.ok) return fail(seq.error)
    const nome = reqString('definir_operacao', obj.value, 'nome')
    if (!nome.ok) return fail(nome.error)
    const centroId = nullableString('definir_operacao', obj.value, 'centroId')
    if (!centroId.ok) return fail(centroId.error)
    const tempoPadraoMin = reqNumber('definir_operacao', obj.value, 'tempoPadraoMin')
    if (!tempoPadraoMin.ok) return fail(tempoPadraoMin.error)
    const tempoPorTamanho = optNumberMap('definir_operacao', obj.value, 'tempoPorTamanho')
    if (!tempoPorTamanho.ok) return fail(tempoPorTamanho.error)
    const tempoSetupMin = optNumber('definir_operacao', obj.value, 'tempoSetupMin')
    if (!tempoSetupMin.ok) return fail(tempoSetupMin.error)
    const loteSetup = optNumber('definir_operacao', obj.value, 'loteSetup')
    if (!loteSetup.ok) return fail(loteSetup.error)
    const agregada = optBoolean('definir_operacao', obj.value, 'agregada')
    if (!agregada.ok) return fail(agregada.error)

    const r = await uc.execute({
      id: id.value,
      modeloId: modeloId.value,
      codigo: codigo.value,
      seq: seq.value,
      nome: nome.value,
      centroId: centroId.value,
      tempoPadraoMin: tempoPadraoMin.value,
      tempoPorTamanho: tempoPorTamanho.value,
      tempoSetupMin: tempoSetupMin.value,
      loteSetup: loteSetup.value,
      agregada: agregada.value,
    })
    return r.ok ? ok({ id: r.value.id }) : fail(r.error)
  },
})
