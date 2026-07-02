import { Json, JsonObject, isJsonObject } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { GetCharge } from '@/contexts/payments/application/ports/in/GetCharge'
import { Charge } from '@/contexts/payments/domain/Charge'
import { Money } from '@/contexts/payments/domain/Money'

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

// Driving adapter for the AI. Read-only -> auto-executes (no confirmation). Reads
// a charge back from PagSeguro to check whether it has been paid. Requires
// PagSeguro to be connected in Settings.
export const getChargeTool = (uc: GetCharge): ToolDefinition => ({
  name: 'get_charge',
  readOnly: true,
  description:
    'Check the status of a PagSeguro charge by id. Input: { chargeId: string }. Returns the charge with its current status ("pending" | "paid" | "canceled" | "failed"). Requires PagSeguro to be connected in Settings.',
  async execute(input: Json) {
    if (!isJsonObject(input)) return fail('get_charge: expected an object')
    const { chargeId } = input
    if (typeof chargeId !== 'string' || chargeId.length === 0) {
      return fail('get_charge: expected { chargeId: string }')
    }
    const r = await uc.execute({ chargeId })
    return r.ok ? ok(chargeToJson(r.value)) : fail(r.error)
  },
})
