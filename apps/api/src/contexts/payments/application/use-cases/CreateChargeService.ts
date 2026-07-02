import { Result, fail } from '@/shared/kernel/Result'
import { CreateCharge, CreateChargeCommand } from '@/contexts/payments/application/ports/in/CreateCharge'
import { PaymentProvider } from '@/contexts/payments/application/ports/out/PaymentProvider'
import { ResolveCredential } from '@/contexts/payments/application/ports/out/ResolveCredential'
import { Charge } from '@/contexts/payments/domain/Charge'
import { PAGSEGURO_PLUGIN, extractToken } from '@/contexts/payments/domain/credential'
import { PaymentError } from '@/contexts/payments/domain/PaymentError'

// Application service. Pure orchestration: resolve the PagSeguro token from the
// credential store via the ResolveCredential ACL; if it is not connected, fail
// with the actionable "connect in Settings" message; otherwise hand off to the
// provider. Depends ONLY on ports.
export class CreateChargeService implements CreateCharge {
  constructor(
    private readonly credentials: ResolveCredential,
    private readonly provider: PaymentProvider,
  ) {}

  async execute(cmd: CreateChargeCommand): Promise<Result<Charge>> {
    const resolved = await this.credentials.resolve({ pluginName: PAGSEGURO_PLUGIN })
    if (!resolved.ok) return fail(resolved.error)
    const token = extractToken(resolved.value)
    if (!token) return fail(PaymentError.notConnected)

    return this.provider.createCharge(token, {
      method: cmd.method,
      amountCents: cmd.amountCents,
      customer: cmd.customer,
      description: cmd.description,
      dueDate: cmd.dueDate,
    })
  }
}
