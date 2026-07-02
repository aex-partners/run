import { Result } from '@/shared/kernel/Result'
import { Boleto } from '@/contexts/payments/domain/Boleto'

// Driving port. Looks a boleto up at the bank by its nossoNumero and returns the
// current `Boleto` (including its registered/paid/expired status).
export interface GetBoletoQuery {
  nossoNumero: string
}

export interface GetBoleto {
  execute(query: GetBoletoQuery): Promise<Result<Boleto>>
}
