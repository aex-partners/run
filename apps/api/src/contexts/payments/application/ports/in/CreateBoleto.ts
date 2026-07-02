import { Result } from '@/shared/kernel/Result'
import { Boleto } from '@/contexts/payments/domain/Boleto'
import { Pagador } from '@/contexts/payments/domain/Pagador'

// Driving port. Plain-data command in, a `Boleto` out. Called by the AI
// `criar_boleto` tool and by the HTTP controller, never with a domain object.
// `valorCents` is an integer in centavos; callers that speak reais convert first.
export interface CreateBoletoCommand {
  pagador: Pagador
  valorCents: number
  // ISO date (YYYY-MM-DD); the boleto due date.
  vencimento: string
  seuNumero?: string
  mensagem?: string
}

export interface CreateBoleto {
  execute(cmd: CreateBoletoCommand): Promise<Result<Boleto>>
}
