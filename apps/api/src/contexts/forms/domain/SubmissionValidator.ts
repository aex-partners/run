import { Result, ok, fail } from '@/shared/kernel/Result'
import { Json, JsonObject } from '@/shared/domain/Json'
import { EntityFieldSpec } from '@/contexts/forms/domain/EntityFieldSpec'

// Server-managed audit fields: a write payload may carry them (ignored) but they
// are never required.
const SYSTEM_TYPES = new Set<string>(['created_at', 'updated_at', 'created_by', 'updated_by'])
// Derived/read-only fields: computed server-side, so setting them is rejected.
const DERIVED_TYPES = new Set<string>(['formula', 'lookup', 'rollup', 'autonumber'])
const COMPUTED_TYPES = new Set<string>([...SYSTEM_TYPES, ...DERIVED_TYPES])

// Pure domain validator. Ported 1:1 from AEX `validateRecordData` (full insert
// mode) but expressed over EntityFieldSpec so the forms context owns the rule and
// never imports the data context. Validation fields already carry the form's
// per-field `required` override (see Form.buildSubmissionFields).
export const SubmissionValidator = {
  validate(data: JsonObject, fields: EntityFieldSpec[]): Result<void> {
    const errors: string[] = []
    const fieldMap = new Map(fields.map((f) => [f.slug, f]))

    // Required check (full insert): skip computed fields.
    for (const field of fields) {
      if (COMPUTED_TYPES.has(field.type)) continue
      const value = data[field.slug]
      if (field.required && (value === undefined || value === null || value === '')) {
        errors.push(`Field "${field.name}" is required.`)
      }
    }

    // Type-check provided values.
    for (const [key, value] of Object.entries(data)) {
      const field = fieldMap.get(key)
      if (!field) {
        errors.push(`Unknown field "${key}".`)
        continue
      }
      if (DERIVED_TYPES.has(field.type)) {
        errors.push(`Field "${field.name}" is computed and cannot be set.`)
        continue
      }
      if (SYSTEM_TYPES.has(field.type)) continue // server-managed; client value ignored
      if (value === null || value === undefined || value === '') continue

      const error = checkValue(field, value)
      if (error) errors.push(error)
    }

    return errors.length === 0 ? ok(undefined) : fail(errors.join(' '))
  },
}

function checkValue(field: EntityFieldSpec, value: Json): string | null {
  switch (field.type) {
    case 'number':
    case 'decimal':
    case 'currency':
    case 'percent':
    case 'duration':
      if (typeof value !== 'number' && isNaN(Number(value))) {
        return `Field "${field.name}" must be a number.`
      }
      return null
    case 'email':
      if (typeof value === 'string' && !value.includes('@')) {
        return `Field "${field.name}" must be a valid email.`
      }
      return null
    case 'url':
      if (typeof value === 'string' && !/^https?:\/\/.+/.test(value)) {
        return `Field "${field.name}" must be a valid URL.`
      }
      return null
    case 'checkbox':
      if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
        return `Field "${field.name}" must be a boolean.`
      }
      return null
    case 'select':
    case 'status':
    case 'priority': {
      const optValues = field.options?.map((o) => o.value) ?? []
      if (optValues.length > 0 && !optValues.includes(String(value))) {
        return `Field "${field.name}" must be one of: ${optValues.join(', ')}.`
      }
      return null
    }
    case 'multiselect': {
      const optValues = field.options?.map((o) => o.value) ?? []
      if (optValues.length > 0) {
        const values = String(value)
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean)
        for (const v of values) {
          if (!optValues.includes(v)) {
            return `Field "${field.name}": "${v}" is not a valid option.`
          }
        }
      }
      return null
    }
    case 'rating': {
      const num = Number(value)
      const max = field.maxRating ?? 5
      if (isNaN(num) || num < 0 || num > max) {
        return `Field "${field.name}" must be between 0 and ${max}.`
      }
      return null
    }
    case 'json':
      if (typeof value === 'string') {
        try {
          JSON.parse(value)
        } catch {
          return `Field "${field.name}" must be valid JSON.`
        }
      }
      return null
    case 'date':
      if (typeof value === 'string' && isNaN(Date.parse(value))) {
        return `Field "${field.name}" must be a valid date.`
      }
      return null
    case 'datetime':
      if (typeof value === 'string' && isNaN(Date.parse(value))) {
        return `Field "${field.name}" must be a valid date-time.`
      }
      return null
    // text, long_text, rich_text, phone, person, relationship, attachment,
    // barcode, ai: no special validation needed.
    default:
      return null
  }
}
