import { Json } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { HistoricoMovimentos } from '@/contexts/estoque/application/ports/in/HistoricoMovimentos'
import { asObject, reqString, optNumber } from '@/contexts/estoque/adapters/in/mcp/estoqueInput'

export const historicoMovimentosTool = (uc: HistoricoMovimentos): ToolDefinition => ({
  name: 'historico_movimentos',
  readOnly: true,
  description:
    'O LIVRO de um insumo: todos os movimentos, do mais recente ao mais antigo. Input: { insumoId: string, limite?: number }. ' +
    'Cada movimento carrega o saldo e o custo médio RESULTANTES, então dá para explicar por que o custo do insumo é o que é hoje, movimento a movimento. ' +
    'Retorna { movimentos: [...], truncado }. truncado=true significa que há movimentos mais antigos que não vieram.',
  async execute(input: Json) {
    const obj = asObject('historico_movimentos', input)
    if (!obj.ok) return fail(obj.error)
    const insumoId = reqString('historico_movimentos', obj.value, 'insumoId')
    if (!insumoId.ok) return fail(insumoId.error)
    const limite = optNumber('historico_movimentos', obj.value, 'limite')
    if (!limite.ok) return fail(limite.error)
    const r = await uc.execute({ insumoId: insumoId.value, limite: limite.value })
    if (!r.ok) return fail(r.error)
    // `.map()` para um objeto literal fresco: `MovimentoView` é uma interface nomeada, sem
    // assinatura de índice, então não é estruturalmente atribuível a `Json` sem isso.
    return ok({
      movimentos: r.value.movimentos.map((m) => ({
        id: m.id,
        tipo: m.tipo,
        qtd: m.qtd,
        custoUnitario: m.custoUnitario,
        data: m.data,
        depositoId: m.depositoId,
        origemTipo: m.origemTipo,
        origemId: m.origemId,
        saldoTotalApos: m.saldoTotalApos,
        custoMedioApos: m.custoMedioApos,
        observacao: m.observacao,
      })),
      truncado: r.value.truncado,
    })
  },
})
