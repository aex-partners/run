import { Result } from '@/shared/kernel/Result'
import { ChargeMethod } from '@/contexts/payments/domain/ChargeMethod'
import { Charge } from '@/contexts/payments/domain/Charge'
import { Customer } from '@/contexts/payments/domain/Customer'

// ACL out-port wrapping the external payment provider (PagSeguro/PagBank). Every
// method takes the already-resolved bearer `token` (the use-case fetches it from
// the credential store via the ResolveCredential ACL and passes it in, so the
// adapter stays stateless and the token is never hardcoded). All HTTP, payload
// mapping and provider quirks live in the adapter; the application sees only this
// port and never a thrown error — failures come back as `Result` failures.
export interface CreateChargeInput {
  method: ChargeMethod
  amountCents: number
  customer: Customer
  description?: string
  // ISO date (YYYY-MM-DD). Used as the boleto due date; ignored for PIX.
  dueDate?: string
}

export interface CreatePaymentLinkInput {
  amountCents: number
  description: string
  customer?: Customer
  // Caller-supplied correlation id echoed back by the provider when supported.
  reference?: string
}

export interface PaymentProvider {
  createCharge(token: string, input: CreateChargeInput): Promise<Result<Charge>>
  getCharge(token: string, id: string): Promise<Result<Charge>>
  createPaymentLink(
    token: string,
    input: CreatePaymentLinkInput,
  ): Promise<Result<{ url: string; id: string }>>
}
