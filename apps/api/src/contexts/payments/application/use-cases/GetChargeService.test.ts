import { describe, it, expect } from 'vitest'
import { ok, Result } from '@/shared/kernel/Result'
import { JsonObject } from '@/shared/domain/Json'
import { GetChargeService } from '@/contexts/payments/application/use-cases/GetChargeService'
import { CreateChargeService } from '@/contexts/payments/application/use-cases/CreateChargeService'
import {
  ResolveCredential,
  ResolveCredentialRequest,
} from '@/contexts/payments/application/ports/out/ResolveCredential'
import { StubPaymentProvider } from '@/contexts/payments/adapters/out/stub/StubPaymentProvider'
import { PaymentError } from '@/contexts/payments/domain/PaymentError'

class StubResolveCredential implements ResolveCredential {
  constructor(private readonly value: JsonObject | null) {}
  async resolve(_req: ResolveCredentialRequest): Promise<Result<JsonObject | null>> {
    return ok(this.value)
  }
}

describe('GetChargeService', () => {
  it('reads a charge back from the provider when connected', async () => {
    const credentials = new StubResolveCredential({ apiKey: 'tok_123' })
    const provider = new StubPaymentProvider()
    const created = await new CreateChargeService(credentials, provider).execute({
      method: 'pix',
      amountCents: 2500,
      customer: { name: 'Bob', email: 'bob@example.com', taxId: '99999999999' },
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const service = new GetChargeService(credentials, provider)
    const r = await service.execute({ chargeId: created.value.id })

    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.id).toBe(created.value.id)
    expect(r.value.method).toBe('pix')
    expect(r.value.pixQrCode).toBeDefined()
  })

  it('fails with the "connect in Settings" message when PagSeguro is not connected', async () => {
    const service = new GetChargeService(new StubResolveCredential(null), new StubPaymentProvider())
    const r = await service.execute({ chargeId: 'anything' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe(PaymentError.notConnected)
  })
})
