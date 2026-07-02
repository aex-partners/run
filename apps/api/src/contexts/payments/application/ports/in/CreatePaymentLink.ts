import { Result } from '@/shared/kernel/Result'
import { Customer } from '@/contexts/payments/domain/Customer'

// Driving port. Creates a hosted PagSeguro checkout and returns its shareable
// URL. `amountCents` is an integer in centavos; callers that speak reais convert.
export interface CreatePaymentLinkCommand {
  amountCents: number
  description: string
  customer?: Customer
  reference?: string
}

export interface CreatePaymentLink {
  execute(cmd: CreatePaymentLinkCommand): Promise<Result<{ url: string; id: string }>>
}
