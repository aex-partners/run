import { Json, JsonObject, isJsonObject } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { CreateCharge } from '@/contexts/payments/application/ports/in/CreateCharge'
import { isChargeMethod } from '@/contexts/payments/domain/ChargeMethod'
import { Charge } from '@/contexts/payments/domain/Charge'
import { Money } from '@/contexts/payments/domain/Money'

// Serialize a Charge to a JSON object for the model, dropping absent optionals
// (the Json algebra has no `undefined`).
const chargeToJson = (c: Charge): JsonObject => {
  const out: JsonObject = {
    id: c.id,
    method: c.method,
    status: c.status,
    amountCents: c.amountCents,
    amount: Money.formatBRL(c.amountCents),
  }
  if (c.dueDate) out.dueDate = c.dueDate
  if (c.boletoLine) out.boletoLine = c.boletoLine
  if (c.pixQrCode) out.pixQrCode = c.pixQrCode
  if (c.link) out.link = c.link
  return out
}

// Driving adapter for the AI. Same in-port the HTTP controller calls; only the
// transport differs. Mutating -> requires confirmation (readOnly: false). Amount
// arrives in reais (BRL) and is converted to centavos. When PagSeguro is not
// connected the in-port fails with the "connect in Settings" message, which is
// surfaced to the model verbatim.
export const createChargeTool = (uc: CreateCharge): ToolDefinition => ({
  name: 'create_charge',
  readOnly: false,
  description:
    'Create a PagSeguro charge (boleto or PIX) for a customer. Input: { method: "boleto" | "pix", amount: number (in BRL, e.g. 149.90), customer: { name: string, email: string, taxId: string (CPF/CNPJ, digits only) }, description?: string, dueDate?: string (YYYY-MM-DD, boleto only) }. Returns the charge id, status and the boleto line or PIX QR code. Requires PagSeguro to be connected in Settings.',
  async execute(input: Json) {
    if (!isJsonObject(input)) return fail('create_charge: expected an object')
    const { method, amount, customer, description, dueDate } = input
    if (!isChargeMethod(method)) return fail('create_charge: method must be "boleto" or "pix"')
    if (typeof amount !== 'number' || !(amount > 0)) return fail('create_charge: amount must be a positive number (BRL)')
    if (customer === undefined || !isJsonObject(customer)) return fail('create_charge: expected customer { name, email, taxId }')
    const { name, email, taxId } = customer
    if (typeof name !== 'string' || typeof email !== 'string' || typeof taxId !== 'string') {
      return fail('create_charge: customer.name, customer.email and customer.taxId are required strings')
    }

    const r = await uc.execute({
      method,
      amountCents: Money.reaisToCents(amount),
      customer: { name, email, taxId },
      description: typeof description === 'string' ? description : undefined,
      dueDate: typeof dueDate === 'string' ? dueDate : undefined,
    })
    return r.ok ? ok(chargeToJson(r.value)) : fail(r.error)
  },
})
