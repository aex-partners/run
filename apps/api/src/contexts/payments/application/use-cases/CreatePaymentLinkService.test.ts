import { describe, it, expect } from 'vitest'
import { ok, Result } from '@/shared/kernel/Result'
import { JsonObject } from '@/shared/domain/Json'
import { CreatePaymentLinkService } from '@/contexts/payments/application/use-cases/CreatePaymentLinkService'
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

describe('CreatePaymentLinkService', () => {
  it('creates a payment link when connected', async () => {
    const service = new CreatePaymentLinkService(
      new StubResolveCredential({ token: 'tok_123' }),
      new StubPaymentProvider(),
    )
    const r = await service.execute({ amountCents: 9900, description: 'Consultoria' })

    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.id).toMatch(/^stub-link-/)
    expect(r.value.url).toContain('https://')
  })

  it('fails with the "connect in Settings" message when PagSeguro is not connected', async () => {
    const service = new CreatePaymentLinkService(
      new StubResolveCredential(null),
      new StubPaymentProvider(),
    )
    const r = await service.execute({ amountCents: 9900, description: 'Consultoria' })

    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe(PaymentError.notConnected)
  })
})
