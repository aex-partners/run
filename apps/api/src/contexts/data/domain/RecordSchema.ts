import { Result, ok, fail } from '@/shared/kernel/Result'
import { Json, JsonObject } from '@/shared/domain/Json'
import { Field } from '@/contexts/data/domain/Field'
import { FormulaFieldType } from '@/contexts/data/domain/FieldType'
import { FormulaEvaluator } from '@/contexts/data/domain/FormulaEvaluator'

// VO. The compiled "type" of a record: the projection of an EntityDefinition
// into a validation spec. The Record aggregate is generic; its invariants are
// PARAMETERIZED by this schema. The schema is built from data, but validate() is
// static, pure interpreter code — this is the Specification pattern.
export class RecordSchema {
  constructor(private readonly fields: readonly Field[]) {}

  validate(input: JsonObject): Result<JsonObject> {
    const out: JsonObject = {}
    const known = new Set(this.fields.map((f) => f.name.value))

    // Reject unknown keys: a record may only carry fields the entity declares.
    for (const key of Object.keys(input)) {
      if (!known.has(key)) return fail(`record: unknown field "${key}"`)
    }

    // Validate/coerce each non-computed field.
    for (const field of this.fields) {
      if (field.type.computed) continue
      const raw: Json = input[field.name.value] ?? null
      if (field.required && raw === null) {
        return fail(`record: field "${field.name.value}" is required`)
      }
      const checked = field.type.validate(raw)
      if (!checked.ok) return fail(`record.${field.name.value}: ${checked.error}`)
      out[field.name.value] = checked.value
    }

    // Compute formula fields from the already-validated values.
    for (const field of this.fields) {
      if (!(field.type instanceof FormulaFieldType)) continue
      const computed = FormulaEvaluator.evaluate(field.type.formula, out)
      if (!computed.ok) return fail(`record.${field.name.value}: ${computed.error}`)
      out[field.name.value] = computed.value
    }

    return ok(out)
  }

  relationFields(): Field[] {
    return this.fields.filter((f) => f.type.kind === 'relation')
  }
}
