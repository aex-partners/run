import { Result } from '@/shared/kernel/Result'

// A PORTA ÚNICA DE ESCRITA do estoque. `compras` entra por ela (tipo 'entrada_nota'),
// e as Fases 2 (consumo de produção) e 3 (saída de venda) vão entrar pela MESMA porta,
// só acrescentando o tipo ao select de `movimentos_de_estoque`. Sem remodelar nada.
export interface RegistrarMovimentoCommand {
  insumoId: string
  depositoId: string
  tipo: string
  // COM SINAL: positivo entra, negativo sai. SEMPRE em unidade de CONSUMO
  // (quem converte de unidade de compra é o `compras`, antes de chegar aqui).
  qtd: number
  // Obrigatório quando o tipo CUSTEIA (entrada_nota / inventario_abertura): é ele que
  // forma o custo médio. Nos demais tipos é ignorado: a quantidade se move ao médio vigente.
  custoUnitario?: number
  data?: string
  origemTipo?: string
  origemId?: string
  observacao?: string
}

export interface MovimentoResumo {
  movimentoId: string
  saldoDeposito: number
  saldoTotal: number
  custoMedio: number
  // Erros SUAVES: o movimento foi gravado no livro. Hoje caem aqui o saldo negativo e
  // uma eventual falha de escrita nas projeções (saldo por depósito / custo médio) — o
  // livro continua correto nos dois casos; nenhum deles desfaz o movimento.
  erros: string[]
}

export interface RegistrarMovimento {
  execute(cmd: RegistrarMovimentoCommand): Promise<Result<MovimentoResumo>>
}
