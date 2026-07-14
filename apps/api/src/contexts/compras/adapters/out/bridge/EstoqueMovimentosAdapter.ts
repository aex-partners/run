import { EstoqueMovimentos, MovimentoEntrada } from '@/contexts/compras/application/ports/out/EstoqueMovimentos'

// Forma LOCAL da in-port RegistrarMovimento do contexto `estoque`. Estruturalmente
// idêntica à fatia que este adapter usa, mantida local (NÃO importada) para que ele
// nunca cruze a fronteira de contexto no nível de tipo -- `dependency-cruiser` barra
// qualquer import cross-context. A in-port concreta injetada por main/wiring/compras.ts
// satisfaz esta forma estruturalmente. Mesma convenção de
// costing/adapters/out/bridge/ManufacturingRoteiroProvider.ts.
interface RegistrarMovimentoLike {
  execute(cmd: {
    insumoId: string
    depositoId: string
    tipo: string
    qtd: number
    custoUnitario?: number
    data?: string
    origemTipo?: string
    origemId?: string
    observacao?: string
  }): Promise<{ ok: boolean; value?: { movimentoId: string; saldoTotal: number; custoMedio: number }; error?: string }>
}

// ACL bridge: compras EstoqueMovimentos -> estoque RegistrarMovimento.
// O tipo é SEMPRE 'entrada_nota': é o único tipo que o `compras` produz, e é um dos dois
// que mudam o custo médio.
export class EstoqueMovimentosAdapter implements EstoqueMovimentos {
  constructor(private readonly deps: { registrarMovimento: RegistrarMovimentoLike }) {}

  async registrarEntrada(m: MovimentoEntrada) {
    const r = await this.deps.registrarMovimento.execute({
      insumoId: m.insumoId,
      depositoId: m.depositoId,
      tipo: 'entrada_nota',
      qtd: m.qtd,
      custoUnitario: m.custoUnitario,
      data: m.data,
      origemTipo: m.origemTipo,
      origemId: m.origemId,
      observacao: m.observacao,
    })
    if (!r.ok || !r.value) throw new Error(r.error ?? 'movimento de estoque recusado')
    return r.value
  }
}
