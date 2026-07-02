import { ok, fail, Result } from '@/shared/kernel/Result'
import {
  CreateChargeInput,
  CreatePaymentLinkInput,
  PaymentProvider,
} from '@/contexts/payments/application/ports/out/PaymentProvider'
import { Charge } from '@/contexts/payments/domain/Charge'
import { ChargeMethod } from '@/contexts/payments/domain/ChargeMethod'
import { ChargeStatus } from '@/contexts/payments/domain/ChargeStatus'
import { Customer } from '@/contexts/payments/domain/Customer'
import { PaymentError } from '@/contexts/payments/domain/PaymentError'

// ACL adapter for PagSeguro / PagBank (Orders & Charges REST API). Base URL comes
// from PAGSEGURO_BASE, defaulting to the sandbox host. Auth is a Bearer token
// passed in per call (resolved by the use-case from the encrypted credential
// store — never hardcoded). Every network/HTTP fault is caught and returned as a
// `Result` failure with a readable message; this adapter NEVER throws across the
// port. The response mapping is defensive because PagSeguro's payload is
// interpreted at runtime (see the payload assumptions in the report).
const DEFAULT_BASE = 'https://sandbox.api.pagseguro.com'

// -- narrowing helpers (keep parsing `any`-free) -----------------------------
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const asString = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
const asNumber = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined)
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

// Fold PagSeguro's raw status vocabulary onto the domain's small set.
const mapStatus = (raw: string | undefined): ChargeStatus => {
  switch ((raw ?? '').toUpperCase()) {
    case 'PAID':
    case 'AVAILABLE':
    case 'AUTHORIZED':
      return 'paid'
    case 'CANCELED':
    case 'CANCELLED':
      return 'canceled'
    case 'DECLINED':
    case 'FAILED':
      return 'failed'
    default:
      // WAITING / IN_ANALYSIS / PENDING / unknown -> pending
      return 'pending'
  }
}

const methodFromType = (raw: string | undefined): ChargeMethod =>
  (raw ?? '').toUpperCase() === 'BOLETO' ? 'boleto' : 'pix'

export class PagSeguroClient implements PaymentProvider {
  constructor(private readonly base: string = process.env.PAGSEGURO_BASE ?? DEFAULT_BASE) {}

  async createCharge(token: string, input: CreateChargeInput): Promise<Result<Charge>> {
    const body: Record<string, unknown> = {
      reference_id: `charge-${Date.now()}`,
      description: input.description ?? 'Charge',
      amount: { value: input.amountCents, currency: 'BRL' },
      payment_method: this.paymentMethod(input),
    }
    const res = await this.request(token, 'POST', '/charges', body)
    if (!res.ok) return res
    return ok(this.mapCharge(res.value, input.method, input.customer))
  }

  async getCharge(token: string, id: string): Promise<Result<Charge>> {
    const res = await this.request(token, 'GET', `/charges/${encodeURIComponent(id)}`)
    if (!res.ok) return res
    return ok(this.mapCharge(res.value))
  }

  async createPaymentLink(
    token: string,
    input: CreatePaymentLinkInput,
  ): Promise<Result<{ url: string; id: string }>> {
    const body: Record<string, unknown> = {
      reference_id: input.reference ?? `link-${Date.now()}`,
      items: [{ name: input.description, quantity: 1, unit_amount: input.amountCents }],
    }
    if (input.customer) {
      body.customer = {
        name: input.customer.name,
        email: input.customer.email,
        tax_id: input.customer.taxId,
      }
    }
    const res = await this.request(token, 'POST', '/checkouts', body)
    if (!res.ok) return res
    const root = res.value
    const id = asString(root.id) ?? ''
    const url = this.payLink(root)
    if (!url) return fail(PaymentError.provider('checkout response did not include a pay link'))
    return ok({ id, url })
  }

  // -- payload -----------------------------------------------------------------
  private paymentMethod(input: CreateChargeInput): Record<string, unknown> {
    if (input.method === 'boleto') {
      return {
        type: 'BOLETO',
        boleto: {
          due_date: input.dueDate,
          instruction_lines: {
            line_1: 'Pagamento processado por AEX',
            line_2: input.description ?? '',
          },
          holder: {
            name: input.customer.name,
            tax_id: input.customer.taxId,
            email: input.customer.email,
          },
        },
      }
    }
    // PIX. PagBank normally emits the QR on an Order; per the integration contract
    // we post it as a PIX charge and read any qr_codes the response carries.
    return { type: 'PIX' }
  }

  // -- response mapping --------------------------------------------------------
  private mapCharge(
    root: Record<string, unknown>,
    fallbackMethod?: ChargeMethod,
    fallbackCustomer?: Customer,
  ): Charge {
    const amount = isRecord(root.amount) ? root.amount : {}
    const pm = isRecord(root.payment_method) ? root.payment_method : {}
    const boleto = isRecord(pm.boleto) ? pm.boleto : {}
    const method = fallbackMethod ?? methodFromType(asString(pm.type))
    const qrCodes = asArray(root.qr_codes)
    const firstQr = isRecord(qrCodes[0]) ? qrCodes[0] : undefined

    return {
      id: asString(root.id) ?? '',
      method,
      amountCents: asNumber(amount.value) ?? 0,
      status: mapStatus(asString(root.status)),
      customer: fallbackCustomer ?? this.mapCustomer(root),
      dueDate: asString(boleto.due_date),
      boletoLine: asString(boleto.formatted_barcode) ?? asString(boleto.barcode),
      pixQrCode: firstQr ? asString(firstQr.text) : undefined,
      link: this.payLink(root),
    }
  }

  private mapCustomer(root: Record<string, unknown>): Customer {
    const c = isRecord(root.customer) ? root.customer : {}
    return {
      name: asString(c.name) ?? '',
      email: asString(c.email) ?? '',
      taxId: asString(c.tax_id) ?? '',
    }
  }

  private payLink(root: Record<string, unknown>): string | undefined {
    const links = asArray(root.links)
    const rels = ['PAY', 'CHECKOUT', 'PAYMENT']
    for (const rel of rels) {
      for (const l of links) {
        if (isRecord(l) && asString(l.rel)?.toUpperCase() === rel) {
          const href = asString(l.href)
          if (href) return href
        }
      }
    }
    // Fall back to the first href of any kind.
    for (const l of links) {
      if (isRecord(l)) {
        const href = asString(l.href)
        if (href) return href
      }
    }
    return undefined
  }

  // -- transport ---------------------------------------------------------------
  private async request(
    token: string,
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
  ): Promise<Result<Record<string, unknown>>> {
    try {
      const res = await fetch(`${this.base}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      const text = await res.text()
      let json: unknown = {}
      if (text) {
        try {
          json = JSON.parse(text)
        } catch {
          json = {}
        }
      }
      if (!res.ok) {
        return fail(PaymentError.provider(`${res.status} ${this.readError(json) ?? text}`))
      }
      return ok(isRecord(json) ? json : {})
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return fail(PaymentError.provider(message))
    }
  }

  // PagSeguro returns errors as { error_messages: [{ description, parameter_name }] }.
  private readError(json: unknown): string | undefined {
    if (!isRecord(json)) return undefined
    const errors = asArray(json.error_messages)
    const parts = errors
      .map((e) => (isRecord(e) ? asString(e.description) : undefined))
      .filter((s): s is string => !!s)
    if (parts.length > 0) return parts.join('; ')
    return asString(json.message)
  }
}
