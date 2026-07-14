import { Json } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { ConsultarSaldo } from '@/contexts/estoque/application/ports/in/ConsultarSaldo'
import { asObject, reqString } from '@/contexts/estoque/adapters/in/mcp/estoqueInput'

export const saldoEstoqueTool = (uc: ConsultarSaldo): ToolDefinition => ({
  name: 'saldo_estoque',
  readOnly: true,
  description:
    'Saldo e custo médio de um insumo. Input: { insumoId: string }. Retorna { insumoId, unidadeConsumo, custoMedio, saldoTotal, porDeposito: [{ depositoId, deposito, qtd }] }. ' +
    'O custo médio é GLOBAL por insumo; o saldo é por depósito. Quantidades na unidade de CONSUMO (a que a ficha técnica usa).',
  async execute(input: Json) {
    const obj = asObject('saldo_estoque', input)
    if (!obj.ok) return fail(obj.error)
    const insumoId = reqString('saldo_estoque', obj.value, 'insumoId')
    if (!insumoId.ok) return fail(insumoId.error)
    const r = await uc.execute({ insumoId: insumoId.value })
    return r.ok ? ok({ ...r.value }) : fail(r.error)
  },
})
