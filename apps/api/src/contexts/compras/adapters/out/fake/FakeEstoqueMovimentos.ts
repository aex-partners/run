import { EstoqueMovimentos, MovimentoEntrada } from '@/contexts/compras/application/ports/out/EstoqueMovimentos'

export interface FakeEstoqueMovimentosOpts {
  // Ids de depósito que existem no mundo de teste. ESPELHA `RegistrarMovimentoService`: um id
  // que não pertence à entidade `depositos` é recusado, mesmo que `store.get` aceitasse
  // qualquer registro. Sem isto o fake é MAIS PERMISSIVO que o real, e é exatamente essa
  // folga que deixou um `depositoId` digitado errado passar por todo o `compras` na prática.
  depositosConhecidos?: Iterable<string>
  // insumoId -> se controla estoque. ESPELHA `RegistrarMovimentoService`: sem
  // `controla_estoque`, o estoque recusa o movimento. O `compras` já recusa isso antes de
  // chegar aqui, mas o fake tem que recusar por conta própria: um fake mais permissivo que o
  // real esconde exatamente a classe de bug em que a validação do lado de cá desaparece.
  produtos?: Map<string, { controlaEstoque: boolean }>
  // Injeta uma falha ALTA arbitrária (timeout, conflito de versão) para exercitar o caminho
  // do movimento parcial — onde a ausência de transação entre compras e estoque aparece.
  falharEm?: (m: MovimentoEntrada) => boolean
  // Injeta erros SUAVES (o movimento É aceito, mas uma projeção como custo_medio/preco_custo
  // falhou depois de o livro já estar gravado) — espelha `MovimentoResumo.erros` do estoque real.
  errosEm?: (m: MovimentoEntrada) => string[]
}

// Fake do ACL para o estoque. Roda o MESMO custo médio ponderado do estoque real (é o
// comportamento que os testes de `compras` precisam observar: o custo que a nota produziu
// virou qual médio), e espelha as MESMAS recusas do `RegistrarMovimentoService` real:
// depósito desconhecido, insumo sem `controla_estoque`, quantidade <= 0, e custo <= 0. Um
// fake mais permissivo que o real esconde exatamente esta classe de bug — já mordeu este
// projeto duas vezes.
export class FakeEstoqueMovimentos implements EstoqueMovimentos {
  readonly recebidos: MovimentoEntrada[] = []
  private seq = 0
  private readonly estado = new Map<string, { saldo: number; custoMedio: number }>()
  private readonly depositosConhecidos: Set<string>
  private readonly produtos: Map<string, { controlaEstoque: boolean }>
  private readonly falharEm?: (m: MovimentoEntrada) => boolean
  private readonly errosEm?: (m: MovimentoEntrada) => string[]

  constructor(opts: FakeEstoqueMovimentosOpts = {}) {
    this.depositosConhecidos = new Set(opts.depositosConhecidos ?? [])
    this.produtos = opts.produtos ?? new Map()
    this.falharEm = opts.falharEm
    this.errosEm = opts.errosEm
  }

  async registrarEntrada(m: MovimentoEntrada) {
    if (this.falharEm?.(m)) throw new Error(`estoque recusou o insumo ${m.insumoId}`)

    // `store.get` aceitaria QUALQUER registro por id; o estoque real confere a pertinência à
    // entidade `depositos`. Espelha isso: sem esta guarda, um `depositoId` inventado passaria
    // pelo fake em silêncio e nenhum teste do `compras` pegaria a falta da validação real.
    if (!this.depositosConhecidos.has(m.depositoId)) {
      throw new Error(`estoque recusou o depósito ${m.depositoId}: não encontrado`)
    }

    // ESPELHA: insumo sem controla_estoque é recusado.
    const produto = this.produtos.get(m.insumoId)
    if (produto && !produto.controlaEstoque) {
      throw new Error(`estoque recusou o insumo ${m.insumoId}: não controla estoque`)
    }

    // ESPELHA: uma entrada exige qtd > 0.
    if (!(m.qtd > 0)) {
      throw new Error(`estoque recusou o insumo ${m.insumoId}: qtd deve ser maior que zero (recebido: ${m.qtd})`)
    }

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

    return { movimentoId: `mov${++this.seq}`, saldoTotal: saldo, custoMedio, erros: this.errosEm?.(m) ?? [] }
  }
}
