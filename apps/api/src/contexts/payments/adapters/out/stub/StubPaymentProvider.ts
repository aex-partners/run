import { ok, Result } from '@/shared/kernel/Result'
import {
  CreateChargeInput,
  CreatePaymentLinkInput,
  PaymentProvider,
} from '@/contexts/payments/application/ports/out/PaymentProvider'
import { Charge } from '@/contexts/payments/domain/Charge'

// In-memory, deterministic PaymentProvider for tests and the offline demo. No
// network: it mints ids from a counter, stores charges, and echoes a boleto line
// or PIX QR code so the shape mirrors the real adapter. Never throws.
export class StubPaymentProvider implements PaymentProvider {
  private seq = 0
  readonly charges = new Map<string, Charge>()

  async createCharge(_token: string, input: CreateChargeInput): Promise<Result<Charge>> {
    this.seq += 1
    const id = `stub-charge-${this.seq}`
    const charge: Charge = {
      id,
      method: input.method,
      amountCents: input.amountCents,
      status: 'pending',
      customer: input.customer,
      dueDate: input.dueDate,
      boletoLine: input.method === 'boleto' ? `00190.00009 ${id}` : undefined,
      pixQrCode: input.method === 'pix' ? `PIX-${id}` : undefined,
    }
    this.charges.set(id, charge)
    return ok(charge)
  }

  async getCharge(_token: string, id: string): Promise<Result<Charge>> {
    const found = this.charges.get(id)
    if (found) return ok(found)
    // Unknown id: return a deterministic pending charge rather than failing, so
    // tests can exercise the happy path without a prior create.
    return ok({
      id,
      method: 'pix',
      amountCents: 0,
      status: 'pending',
      customer: { name: '', email: '', taxId: '' },
    })
  }

  async createPaymentLink(
    _token: string,
    _input: CreatePaymentLinkInput,
  ): Promise<Result<{ url: string; id: string }>> {
    this.seq += 1
    const id = `stub-link-${this.seq}`
    return ok({ id, url: `https://pay.example/${id}` })
  }
}
