import { Result } from '@/shared/kernel/Result'
import { ChargeMethod } from '@/contexts/payments/domain/ChargeMethod'
import { Charge } from '@/contexts/payments/domain/Charge'
import { Customer } from '@/contexts/payments/domain/Customer'

// Driving port. Plain-data command in, a `Charge` out. Called by the AI
// `create_charge` tool and by the HTTP controller, never with a domain object.
// `amountCents` is an integer in centavos; callers that speak reais convert first.
export interface CreateChargeCommand {
  method: ChargeMethod
  amountCents: number
  customer: Customer
  description?: string
  // ISO date (YYYY-MM-DD); the boleto due date. Ignored for PIX.
  dueDate?: string
}

export interface CreateCharge {
  execute(cmd: CreateChargeCommand): Promise<Result<Charge>>
}
