import { Json, isJsonObject } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { CreatePaymentLink } from '@/contexts/payments/application/ports/in/CreatePaymentLink'
import { Money } from '@/contexts/payments/domain/Money'

// Driving adapter for the AI. Mutating -> requires confirmation (readOnly: false).
// Creates a hosted PagSeguro checkout and returns its shareable URL. Amount
// arrives in reais (BRL). Requires PagSeguro to be connected in Settings.
export const createPaymentLinkTool = (uc: CreatePaymentLink): ToolDefinition => ({
  name: 'create_payment_link',
  readOnly: false,
  description:
    'Create a shareable PagSeguro payment link (hosted checkout). Input: { amount: number (in BRL, e.g. 149.90), description: string, customer?: { name: string, email: string, taxId: string }, reference?: string }. Returns { id, url }. Requires PagSeguro to be connected in Settings.',
  async execute(input: Json) {
    if (!isJsonObject(input)) return fail('create_payment_link: expected an object')
    const { amount, description, customer, reference } = input
    if (typeof amount !== 'number' || !(amount > 0)) return fail('create_payment_link: amount must be a positive number (BRL)')
    if (typeof description !== 'string' || description.length === 0) {
      return fail('create_payment_link: expected a non-empty description')
    }

    let customerArg: { name: string; email: string; taxId: string } | undefined
    if (customer !== undefined) {
      if (!isJsonObject(customer)) return fail('create_payment_link: customer must be an object')
      const { name, email, taxId } = customer
      if (typeof name !== 'string' || typeof email !== 'string' || typeof taxId !== 'string') {
        return fail('create_payment_link: customer.name, customer.email and customer.taxId must be strings')
      }
      customerArg = { name, email, taxId }
    }

    const r = await uc.execute({
      amountCents: Money.reaisToCents(amount),
      description,
      customer: customerArg,
      reference: typeof reference === 'string' ? reference : undefined,
    })
    return r.ok ? ok({ id: r.value.id, url: r.value.url }) : fail(r.error)
  },
})
