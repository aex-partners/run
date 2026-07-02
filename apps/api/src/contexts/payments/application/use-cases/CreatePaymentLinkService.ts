import { Result, fail } from '@/shared/kernel/Result'
import {
  CreatePaymentLink,
  CreatePaymentLinkCommand,
} from '@/contexts/payments/application/ports/in/CreatePaymentLink'
import { PaymentProvider } from '@/contexts/payments/application/ports/out/PaymentProvider'
import { ResolveCredential } from '@/contexts/payments/application/ports/out/ResolveCredential'
import { PAGSEGURO_PLUGIN, extractToken } from '@/contexts/payments/domain/credential'
import { PaymentError } from '@/contexts/payments/domain/PaymentError'

// Application service. Resolve the PagSeguro token (fail with the "connect in
// Settings" message when absent), then create a hosted checkout link.
export class CreatePaymentLinkService implements CreatePaymentLink {
  constructor(
    private readonly credentials: ResolveCredential,
    private readonly provider: PaymentProvider,
  ) {}

  async execute(cmd: CreatePaymentLinkCommand): Promise<Result<{ url: string; id: string }>> {
    const resolved = await this.credentials.resolve({ pluginName: PAGSEGURO_PLUGIN })
    if (!resolved.ok) return fail(resolved.error)
    const token = extractToken(resolved.value)
    if (!token) return fail(PaymentError.notConnected)

    return this.provider.createPaymentLink(token, {
      amountCents: cmd.amountCents,
      description: cmd.description,
      customer: cmd.customer,
      reference: cmd.reference,
    })
  }
}
