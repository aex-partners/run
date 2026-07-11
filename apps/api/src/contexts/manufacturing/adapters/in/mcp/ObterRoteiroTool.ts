import { Json } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { ObterRoteiro } from '@/contexts/manufacturing/application/ports/in/ObterRoteiro'
import { asObject, reqString } from '@/contexts/manufacturing/adapters/in/mcp/manufacturingInput'

// Driving adapter for the AI (Eric). Read-only (readOnly: true) -> auto-executes,
// no confirmation. Devolve o roteiro PUBLICADO (última revisão) de um modelo: as
// operações que efetivamente custeiam a conversão, mais os centros usados. Nunca
// falha por ausência: modelo sem roteiro publicado devolve { roteiro: null }.
export const obterRoteiroTool = (uc: ObterRoteiro): ToolDefinition => ({
  name: 'obter_roteiro',
  readOnly: true,
  description:
    'Consulta o roteiro de produção PUBLICADO (última revisão) de um Modelo. Input: { modeloId: string }. Retorna { roteiro: { modeloId, rev, operacoes: [{ id, seq, centroId, tempoPadraoMin, tempoPorTamanho, tempoSetupMin, loteSetup }], centros: [{ id, custoMinMod }] } | null }. Tempos em MINUTOS; roteiro null = o modelo ainda não tem revisão publicada (rascunhos não aparecem aqui).',
  async execute(input: Json) {
    const obj = asObject('obter_roteiro', input)
    if (!obj.ok) return fail(obj.error)
    const modeloId = reqString('obter_roteiro', obj.value, 'modeloId')
    if (!modeloId.ok) return fail(modeloId.error)
    const view = await uc.execute({ modeloId: modeloId.value })
    if (!view) return ok({ roteiro: null })
    return ok({
      roteiro: {
        modeloId: view.modeloId,
        rev: view.rev,
        operacoes: view.operacoes.map((o) => ({
          id: o.id,
          seq: o.seq,
          centroId: o.centroId,
          tempoPadraoMin: o.tempoPadraoMin,
          tempoPorTamanho: o.tempoPorTamanho,
          tempoSetupMin: o.tempoSetupMin,
          loteSetup: o.loteSetup,
        })),
        centros: view.centros.map((c) => ({ id: c.id, custoMinMod: c.custoMinMod })),
      },
    })
  },
})
