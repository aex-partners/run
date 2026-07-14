import { Json } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { RegistrarMovimento } from '@/contexts/estoque/application/ports/in/RegistrarMovimento'
import { asObject, reqString, optString, reqNumber, optNumber } from '@/contexts/estoque/adapters/in/mcp/estoqueInput'

// Os tipos que o Eric PODE lançar. `entrada_nota` NÃO está aqui de propósito: entrada de
// material só entra pelo `compras`, com nota. Se o Eric pudesse lançar entrada_nota
// direto, o estoque ganharia entradas SEM DOCUMENTO, o custo médio mudaria sem lastro, e
// ninguém saberia de onde veio o número.
const TIPOS_PERMITIDOS = ['inventario_abertura', 'ajuste', 'contagem', 'devolucao_fornecedor', 'saida_manual']

export const registrarMovimentoTool = (uc: RegistrarMovimento): ToolDefinition => ({
  name: 'registrar_movimento_estoque',
  readOnly: false,
  description:
    'Registra um movimento de estoque. Input: { insumoId: string, depositoId: string, tipo: string, qtd: number, custoUnitario?: number, observacao?: string }. ' +
    `tipo ∈ [${TIPOS_PERMITIDOS.join(', ')}]. qtd COM SINAL (positiva entra, negativa sai), na unidade de CONSUMO do insumo. ` +
    'custoUnitario é OBRIGATÓRIO em inventario_abertura (é ele que semeia o custo médio) e ignorado nos demais tipos, que se movem ao custo médio vigente. ' +
    'Entrada de compra NÃO entra por aqui: use lancar_nota_entrada. Retorna { movimentoId, saldoDeposito, saldoTotal, custoMedio, erros: string[] }. ' +
    'erros traz avisos SUAVES: o movimento FOI gravado, mas algo merece atenção (ex.: saldo ficou negativo, ou uma projeção de saldo/custo médio falhou ao atualizar). Nunca desfaz o movimento. SEMPRE mostre os erros ao usuário.',
  async execute(input: Json) {
    const obj = asObject('registrar_movimento_estoque', input)
    if (!obj.ok) return fail(obj.error)
    const insumoId = reqString('registrar_movimento_estoque', obj.value, 'insumoId')
    if (!insumoId.ok) return fail(insumoId.error)
    const depositoId = reqString('registrar_movimento_estoque', obj.value, 'depositoId')
    if (!depositoId.ok) return fail(depositoId.error)
    const tipo = reqString('registrar_movimento_estoque', obj.value, 'tipo')
    if (!tipo.ok) return fail(tipo.error)
    if (!TIPOS_PERMITIDOS.includes(tipo.value)) {
      return fail(
        `registrar_movimento_estoque: tipo "${tipo.value}" não permitido aqui. Válidos: ${TIPOS_PERMITIDOS.join(', ')}. ` +
        'Entrada de compra é lançada por lancar_nota_entrada, com a nota do fornecedor.',
      )
    }
    const qtd = reqNumber('registrar_movimento_estoque', obj.value, 'qtd')
    if (!qtd.ok) return fail(qtd.error)
    const custoUnitario = optNumber('registrar_movimento_estoque', obj.value, 'custoUnitario')
    if (!custoUnitario.ok) return fail(custoUnitario.error)
    const observacao = optString('registrar_movimento_estoque', obj.value, 'observacao')
    if (!observacao.ok) return fail(observacao.error)

    const r = await uc.execute({
      insumoId: insumoId.value,
      depositoId: depositoId.value,
      tipo: tipo.value,
      qtd: qtd.value,
      custoUnitario: custoUnitario.value,
      observacao: observacao.value,
    })
    return r.ok ? ok({ ...r.value }) : fail(r.error)
  },
})
