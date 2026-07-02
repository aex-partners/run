import { Result, fail } from '@/shared/kernel/Result'
import { GetCharge, GetChargeQuery } from '@/contexts/payments/application/ports/in/GetCharge'
import { PaymentProvider } from '@/contexts/payments/application/ports/out/PaymentProvider'
import { ResolveCredential } from '@/contexts/payments/application/ports/out/ResolveCredential'
import { Charge } from '@/contexts/payments/domain/Charge'
import { PAGSEGURO_PLUGIN, extractToken } from '@/contexts/payments/domain/credential'
import { PaymentError } from '@/contexts/payments/domain/PaymentError'

// Application service. Resolve the PagSeguro token (fail with the "connect in
// Settings" message when absent), then read the charge back from the provider.
export class GetChargeService implements GetCharge {
  constructor(
    private readonly credentials: ResolveCredential,
    private readonly provider: PaymentProvider,
  ) {}

  async execute(query: GetChargeQuery): Promise<Result<Charge>> {
    const resolved = await this.credentials.resolve({ pluginName: PAGSEGURO_PLUGIN })
    if (!resolved.ok) return fail(resolved.error)
    const token = extractToken(resolved.value)
    if (!token) return fail(PaymentError.notConnected)

    return this.provider.getCharge(token, query.chargeId)
  }
}
