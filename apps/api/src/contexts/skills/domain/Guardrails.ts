import { Result, ok, fail } from '@/shared/kernel/Result'
import { JsonObject } from '@/shared/domain/Json'

// Plain, boundary-friendly shape of the guardrails — what crosses ports and
// lands in the read model. Mirrors the source zod object
// `{ maxSteps?, blockedTools?, requireConfirmation? }`.
export interface GuardrailsValue {
  maxSteps?: number
  blockedTools?: string[]
  requireConfirmation?: boolean
}

// VALUE OBJECT. The safety envelope a skill imposes on the agent that runs it:
// an optional step cap, a blocklist of tools, and a confirmation gate. `of` is a
// PURE validating factory; `fromJSON` trusts persisted data and only coerces. The
// VO is immutable — a skill swaps its whole Guardrails on update, never mutates.
export class Guardrails {
  private constructor(private readonly props: GuardrailsValue) {}

  static empty(): Guardrails {
    return new Guardrails({})
  }

  // PURE validation. maxSteps must be a positive integer; blocked tools must be
  // non-empty (deduped, order-preserving); requireConfirmation is a flag.
  static of(input: GuardrailsValue): Result<Guardrails> {
    const props: GuardrailsValue = {}

    if (input.maxSteps !== undefined) {
      if (!Number.isInteger(input.maxSteps) || input.maxSteps < 1) {
        return fail('Guardrails: maxSteps must be a positive integer')
      }
      props.maxSteps = input.maxSteps
    }

    if (input.blockedTools !== undefined) {
      const tools: string[] = []
      for (const raw of input.blockedTools) {
        const tool = raw.trim()
        if (tool.length < 1) return fail('Guardrails: blockedTools entries must be non-empty')
        if (!tools.includes(tool)) tools.push(tool)
      }
      props.blockedTools = tools
    }

    if (input.requireConfirmation !== undefined) {
      props.requireConfirmation = input.requireConfirmation
    }

    return ok(new Guardrails(props))
  }

  // Rehydrate from a persisted JSON object (the `guardrails` text column). Trusts
  // stored data: defensively reads known keys, never fails.
  static fromJSON(value: JsonObject): Guardrails {
    const props: GuardrailsValue = {}

    const maxSteps = value['maxSteps']
    if (typeof maxSteps === 'number' && Number.isInteger(maxSteps) && maxSteps >= 1) {
      props.maxSteps = maxSteps
    }

    const blocked = value['blockedTools']
    if (Array.isArray(blocked)) {
      const tools: string[] = []
      for (const t of blocked) {
        if (typeof t === 'string' && t.trim().length > 0 && !tools.includes(t)) tools.push(t)
      }
      props.blockedTools = tools
    }

    const requireConfirmation = value['requireConfirmation']
    if (typeof requireConfirmation === 'boolean') {
      props.requireConfirmation = requireConfirmation
    }

    return new Guardrails(props)
  }

  get maxSteps(): number | undefined {
    return this.props.maxSteps
  }

  get blockedTools(): readonly string[] | undefined {
    return this.props.blockedTools
  }

  get requireConfirmation(): boolean | undefined {
    return this.props.requireConfirmation
  }

  // Plain copy for ports / read models.
  toValue(): GuardrailsValue {
    const out: GuardrailsValue = {}
    if (this.props.maxSteps !== undefined) out.maxSteps = this.props.maxSteps
    if (this.props.blockedTools !== undefined) out.blockedTools = [...this.props.blockedTools]
    if (this.props.requireConfirmation !== undefined) out.requireConfirmation = this.props.requireConfirmation
    return out
  }

  // JSON projection for the persistence text column.
  toJSON(): JsonObject {
    const out: JsonObject = {}
    if (this.props.maxSteps !== undefined) out['maxSteps'] = this.props.maxSteps
    if (this.props.blockedTools !== undefined) out['blockedTools'] = [...this.props.blockedTools]
    if (this.props.requireConfirmation !== undefined) out['requireConfirmation'] = this.props.requireConfirmation
    return out
  }
}
