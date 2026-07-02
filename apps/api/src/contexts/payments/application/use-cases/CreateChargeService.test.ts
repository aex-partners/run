import { describe, it, expect } from 'vitest'
import { ok, Result } from '@/shared/kernel/Result'
import { JsonObject } from '@/shared/domain/Json'
import { CreateChargeService } from '@/contexts/payments/application/use-cases/CreateChargeService'
import {
  ResolveCredential,
  ResolveCredentialRequest,
} from '@/contexts/payments/application/ports/out/ResolveCredential'
import { StubPaymentProvider } from '@/contexts/payments/adapters/out/stub/StubPaymentProvider'
import { PaymentError } from '@/contexts/payments/domain/PaymentError'

class StubResolveCredential implements ResolveCredential {
  readonly requests: ResolveCredentialRequest[] = []
  constructor(private readonly value: JsonObject | null) {}
  async resolve(req: ResolveCredentialRequest): Promise<Result<JsonObject | null>> {
    this.requests.push(req)
    return ok(this.value)
  }
}

const CUSTOMER = { name: 'Ana', email: 'ana@example.com', taxId: '12345678909' }

describe('CreateChargeService', () => {
  it('resolves the PagSeguro token and creates a boleto charge', async () => {
    const credentials = new StubResolveCredential({ token: 'tok_123' })
    const provider = new StubPaymentProvider()
    const service = new CreateChargeService(credentials, provider)

    const r = await service.execute({
      method: 'boleto',
      amountCents: 14990,
      customer: CUSTOMER,
      dueDate: '2026-07-10',
    })

    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.method).toBe('boleto')
    expect(r.value.amountCents).toBe(14990)
    expect(r.value.status).toBe('pending')
    expect(r.value.boletoLine).toBeDefined()
    // resolved by the "pagseguro" plugin name.
    expect(credentials.requests[0]?.pluginName).toBe('pagseguro')
    // the charge reached the provider (deterministic stub).
    expect(provider.charges.get(r.value.id)?.method).toBe('boleto')
  })

  it('fails with the "connect in Settings" message when PagSeguro is not connected', async () => {
    const credentials = new StubResolveCredential(null)
    const provider = new StubPaymentProvider()
    const service = new CreateChargeService(credentials, provider)

    const r = await service.execute({ method: 'pix', amountCents: 5000, customer: CUSTOMER })

    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe(PaymentError.notConnected)
    // never reached the provider.
    expect(provider.charges.size).toBe(0)
  })
})
