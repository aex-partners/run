import { ChargeMethod } from '@/contexts/payments/domain/ChargeMethod'
import { ChargeStatus } from '@/contexts/payments/domain/ChargeStatus'
import { Customer } from '@/contexts/payments/domain/Customer'

// A charge as the payments context models it, independent of any provider shape.
// `amountCents` is an integer in centavos (BRL has 2 decimals) so money never
// rides on a float. Exactly one payer artefact is populated per method: a boleto
// exposes `boletoLine`, a PIX exposes `pixQrCode`; `link` is the hosted checkout
// URL when the provider returns one.
export interface Charge {
  readonly id: string
  readonly method: ChargeMethod
  readonly amountCents: number
  readonly status: ChargeStatus
  readonly customer: Customer
  readonly dueDate?: string
  readonly boletoLine?: string
  readonly pixQrCode?: string
  readonly link?: string
}
