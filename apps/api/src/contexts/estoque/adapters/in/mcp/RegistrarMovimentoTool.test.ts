import { describe, it, expect } from 'vitest'
import { ok, fail, Result } from '@/shared/kernel/Result'
import { registrarMovimentoTool } from '@/contexts/estoque/adapters/in/mcp/RegistrarMovimentoTool'
import { saldoEstoqueTool } from '@/contexts/estoque/adapters/in/mcp/SaldoEstoqueTool'
import { historicoMovimentosTool } from '@/contexts/estoque/adapters/in/mcp/HistoricoMovimentosTool'
import { lancarNotaEntradaTool } from '@/contexts/compras/adapters/in/mcp/LancarNotaEntradaTool'
import { criarPedidoCompraTool } from '@/contexts/compras/adapters/in/mcp/CriarPedidoCompraTool'
import { consultarPedidoCompraTool } from '@/contexts/compras/adapters/in/mcp/ConsultarPedidoCompraTool'
import { RegistrarMovimento } from '@/contexts/estoque/application/ports/in/RegistrarMovimento'
import { ConsultarSaldo } from '@/contexts/estoque/application/ports/in/ConsultarSaldo'
import { HistoricoMovimentos } from '@/contexts/estoque/application/ports/in/HistoricoMovimentos'
import { LancarNotaEntrada } from '@/contexts/compras/application/ports/in/LancarNotaEntrada'
import { CriarPedidoCompra } from '@/contexts/compras/application/ports/in/CriarPedidoCompra'
import { ConsultarPedidoCompra } from '@/contexts/compras/application/ports/in/ConsultarPedidoCompra'

// Stub que ACEITA tudo: assim, um movimento que chega até aqui é um movimento que a TOOL
// deixou passar. É a guarda da tool que está sendo testada, não a do serviço.
function stub() {
  const chamadas: { tipo: string }[] = []
  const uc: RegistrarMovimento = {
    async execute(cmd) {
      chamadas.push({ tipo: cmd.tipo })
      return ok({ movimentoId: 'm1', saldoDeposito: 1, saldoTotal: 1, custoMedio: 1, erros: [] })
    },
  }
  return { uc, chamadas }
}

const input = (over: Record<string, unknown> = {}) => ({
  insumoId: 'TECIDO', depositoId: 'DEP1', tipo: 'ajuste', qtd: 10, ...over,
})

describe('registrar_movimento_estoque', () => {
  // A GUARDA MAIS IMPORTANTE DESTA CAMADA. Entrada de material comprado só entra por
  // `lancar_nota_entrada`, com documento. Se o Eric pudesse lançar `entrada_nota` direto, o
  // estoque ganharia material SEM NOTA, o custo médio mudaria sem lastro, e ninguém saberia
  // de onde veio o número.
  it('RECUSA o tipo entrada_nota, e nem chama a in-port', async () => {
    const { uc, chamadas } = stub()
    const r = await registrarMovimentoTool(uc).execute(input({ tipo: 'entrada_nota', custoUnitario: 10 }))
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toContain('entrada_nota')
    expect(!r.ok && r.error).toContain('lancar_nota_entrada')   // diz o que fazer no lugar
    expect(chamadas).toHaveLength(0)                            // a in-port NEM foi chamada
  })

  it('aceita os cinco tipos que o usuário PODE lançar', async () => {
    for (const tipo of ['inventario_abertura', 'ajuste', 'contagem', 'devolucao_fornecedor', 'saida_manual']) {
      const { uc, chamadas } = stub()
      const r = await registrarMovimentoTool(uc).execute(
        input({ tipo, custoUnitario: tipo === 'inventario_abertura' ? 10 : undefined }),
      )
      expect(r.ok).toBe(true)
      expect(chamadas.map((c) => c.tipo)).toEqual([tipo])
    }
  })

  it('é uma tool de ESCRITA: readOnly false (exige confirmação do usuário)', () => {
    expect(registrarMovimentoTool(stub().uc).readOnly).toBe(false)
  })

  // A tool NUNCA pode lançar exceção: o contrato de ToolDefinition é devolver Result.
  it('input malformado devolve Result de falha, nunca lança', async () => {
    const { uc } = stub()
    const tool = registrarMovimentoTool(uc)
    for (const mau of [null, 'texto', 42, [], {}, { insumoId: 'X' }, input({ qtd: 'dez' }), input({ tipo: 123 })]) {
      const r = await tool.execute(mau as never)
      expect(r.ok).toBe(false)
    }
  })
})

// Stub genérico para as demais tools: aqui só olhamos a flag ESTÁTICA `readOnly`, então a
// in-port nunca precisa ser de fato chamada.
const naoUsado = async (): Promise<Result<never>> => fail('stub: não deveria ser chamado neste teste')

// A tabela cobre TODAS as tools MCP hoje existentes nos contextos compras + estoque (6 no
// total: as 5 abaixo, mais registrar_movimento_estoque, já coberta acima). Uma tool de
// escrita mal marcada `readOnly: true` executaria SEM confirmação do usuário — hoje nada
// pega isso.
describe('tabela de readOnly (compras + estoque)', () => {
  it('escrita pede confirmação (readOnly:false); leitura não (readOnly:true)', () => {
    const registrarStub: RegistrarMovimento = { execute: naoUsado }
    const saldoStub: ConsultarSaldo = { execute: naoUsado }
    const historicoStub: HistoricoMovimentos = { execute: naoUsado }
    const notaStub: LancarNotaEntrada = { execute: naoUsado }
    const pedidoStub: CriarPedidoCompra = { execute: naoUsado }
    const consultarPedidoStub: ConsultarPedidoCompra = { execute: naoUsado }

    const tabela = [
      { nome: 'registrar_movimento_estoque', readOnly: registrarMovimentoTool(registrarStub).readOnly },
      { nome: 'saldo_estoque', readOnly: saldoEstoqueTool(saldoStub).readOnly },
      { nome: 'historico_movimentos', readOnly: historicoMovimentosTool(historicoStub).readOnly },
      { nome: 'lancar_nota_entrada', readOnly: lancarNotaEntradaTool(notaStub).readOnly },
      { nome: 'criar_pedido_compra', readOnly: criarPedidoCompraTool(pedidoStub).readOnly },
      { nome: 'consultar_pedido_compra', readOnly: consultarPedidoCompraTool(consultarPedidoStub).readOnly },
    ]

    expect(tabela).toEqual([
      { nome: 'registrar_movimento_estoque', readOnly: false },
      { nome: 'saldo_estoque', readOnly: true },
      { nome: 'historico_movimentos', readOnly: true },
      { nome: 'lancar_nota_entrada', readOnly: false },
      { nome: 'criar_pedido_compra', readOnly: false },
      { nome: 'consultar_pedido_compra', readOnly: true },
    ])
  })
})
