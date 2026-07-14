import { Result } from '@/shared/kernel/Result'

export interface SaldoView {
  insumoId: string
  unidadeConsumo: string
  custoMedio: number
  saldoTotal: number
  porDeposito: { depositoId: string; deposito: string; qtd: number }[]
}

export interface ConsultarSaldo {
  execute(q: { insumoId: string }): Promise<Result<SaldoView>>
}
