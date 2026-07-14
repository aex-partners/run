import { EstoqueMovimentos, MovimentoEntrada } from '@/contexts/compras/application/ports/out/EstoqueMovimentos'

// Fake do ACL para o estoque. Roda o MESMO custo médio ponderado do estoque real (é o
// comportamento que os testes de `compras` precisam observar: o custo que a nota
// produziu virou qual médio). `falharEm` permite exercitar o caminho do movimento
// parcial, que é onde a ausência de transação aparece.
export class FakeEstoqueMovimentos implements EstoqueMovimentos {
  readonly recebidos: MovimentoEntrada[] = []
  private seq = 0
  private readonly estado = new Map<string, { saldo: number; custoMedio: number }>()

  constructor(private readonly falharEm?: (m: MovimentoEntrada) => boolean) {}

  async registrarEntrada(m: MovimentoEntrada) {
    if (this.falharEm?.(m)) throw new Error(`estoque recusou o insumo ${m.insumoId}`)
    // ESPELHA a regra real do estoque: uma entrada com custo <= 0 é RECUSADA (zeraria o custo
    // médio em silêncio). Um fake mais permissivo que o real esconde exatamente esta classe de bug.
    if (!(m.custoUnitario > 0)) {
      throw new Error(`estoque recusou o insumo ${m.insumoId}: custoUnitario deve ser maior que zero (recebido: ${m.custoUnitario})`)
    }
    this.recebidos.push(m)

    const atual = this.estado.get(m.insumoId) ?? { saldo: 0, custoMedio: 0 }
    const saldo = atual.saldo + m.qtd
    const custoMedio = atual.saldo <= 0
      ? m.custoUnitario
      : (atual.saldo * atual.custoMedio + m.qtd * m.custoUnitario) / saldo
    this.estado.set(m.insumoId, { saldo, custoMedio })

    return { movimentoId: `mov${++this.seq}`, saldoTotal: saldo, custoMedio }
  }
}
