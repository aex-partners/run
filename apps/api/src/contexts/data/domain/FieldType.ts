import { Result, ok, fail } from '@/shared/kernel/Result'
import { Json, isJsonObject } from '@/shared/domain/Json'
import { Formula } from '@/contexts/data/domain/Formula'

export type TypedValue = Json

// An option of a choice field (select/multiselect/status/priority). Ported 1:1
// from AEX's `EntityFieldOption` so labels and colors survive a round-trip.
export interface EntityFieldOption {
  value: string
  label: string
  color?: string
}

// How a field's value is treated by the dynamic query engine when it filters,
// sorts, or aggregates. Mirrors query-engine.ts `castKind`: numeric/date/text.
export type CastKind = 'numeric' | 'date' | 'text'

// Strategy interface. Each field type knows how to validate/coerce, compare, and
// classify its values. `computed` fields derive their value (formula) or are
// server-managed (created_at, ...) instead of accepting user input.
export interface FieldType {
  readonly kind: string
  readonly computed: boolean
  validate(value: Json): Result<TypedValue>
  compare(a: TypedValue, b: TypedValue): number
  castKind(): CastKind
  // Serialize back to its persisted descriptor (used by the mapper).
  toConfig(): FieldTypeConfig
}

// The persisted descriptor of a field type. This is the DATA the user defines at
// runtime; the closed set of classes below is the CODE that interprets it. The
// set is sealed: adding a kind is a code change here, never user data.
export type FieldTypeConfig =
  | { kind: 'text' }
  | { kind: 'long_text' }
  | { kind: 'rich_text' }
  | { kind: 'number' }
  | { kind: 'decimal'; decimalPlaces?: number }
  | { kind: 'currency'; currencyCode?: string; decimalPlaces?: number }
  | { kind: 'percent'; decimalPlaces?: number }
  | { kind: 'date' }
  | { kind: 'datetime' }
  | { kind: 'duration' }
  | { kind: 'boolean' }
  | { kind: 'select'; options: EntityFieldOption[] }
  | { kind: 'multiselect'; options: EntityFieldOption[] }
  | { kind: 'status'; options: EntityFieldOption[] }
  | { kind: 'priority'; options: EntityFieldOption[] }
  | { kind: 'rating'; maxRating?: number }
  | { kind: 'email' }
  | { kind: 'url' }
  | { kind: 'phone' }
  // Image(s): value is an image URL (or an array of URLs). Rendered as thumbnails.
  | { kind: 'image' }
  // Postal address: value is a structured object (logradouro, numero, bairro, cep,
  // municipio, uf, ...). Stored as a JSON object in the record data.
  | { kind: 'address' }
  | { kind: 'person' }
  | {
      kind: 'relation'
      targetEntityId: string
      targetEntityName?: string
      // Which field of the TARGET entity to show as the relation's label (id or
      // slug). Falls back to the title heuristic on the read side when absent.
      labelFieldId?: string
      // Whether the relation may hold several target ids (stored flag; the cell
      // still single-selects today).
      multiple?: boolean
    }
  | { kind: 'lookup'; viaFieldId?: string; lookupFieldId?: string }
  | { kind: 'rollup'; viaFieldId?: string; lookupFieldId?: string; rollupFunction?: string }
  | { kind: 'formula'; expression: string }
  | { kind: 'autonumber' }
  | { kind: 'attachment' }
  | { kind: 'json' }
  | { kind: 'barcode' }
  | { kind: 'ai'; aiPrompt?: string }
  | { kind: 'created_at' }
  | { kind: 'updated_at' }
  | { kind: 'created_by' }
  | { kind: 'updated_by' }

// --- helpers -------------------------------------------------------------

const isNumeric = (value: Json): boolean =>
  typeof value === 'number' || (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value)))

const cmpNumber = (a: TypedValue, b: TypedValue): number => Number(a ?? 0) - Number(b ?? 0)
const cmpString = (a: TypedValue, b: TypedValue): number => String(a ?? '').localeCompare(String(b ?? ''))
const cmpDate = (a: TypedValue, b: TypedValue): number => Date.parse(String(a ?? 0)) - Date.parse(String(b ?? 0))

// --- text family ---------------------------------------------------------

class TextFieldType implements FieldType {
  readonly kind = 'text'
  readonly computed = false
  validate(value: Json): Result<TypedValue> {
    if (value === null) return ok(null)
    return typeof value === 'string' ? ok(value) : fail('text: expected string')
  }
  compare(a: TypedValue, b: TypedValue): number {
    return cmpString(a, b)
  }
  castKind(): CastKind {
    return 'text'
  }
  toConfig(): FieldTypeConfig {
    return { kind: 'text' }
  }
}

// long_text / rich_text / phone / person / barcode / attachment: free-form text,
// no extra validation (matches AEX which type-checks none of these).
class FreeTextFieldType implements FieldType {
  readonly computed = false
  constructor(public readonly kind: string) {}
  validate(value: Json): Result<TypedValue> {
    if (value === null) return ok(null)
    return typeof value === 'string' ? ok(value) : fail(`${this.kind}: expected string`)
  }
  compare(a: TypedValue, b: TypedValue): number {
    return cmpString(a, b)
  }
  castKind(): CastKind {
    return 'text'
  }
  toConfig(): FieldTypeConfig {
    return { kind: this.kind } as FieldTypeConfig
  }
}

class EmailFieldType implements FieldType {
  readonly kind = 'email'
  readonly computed = false
  validate(value: Json): Result<TypedValue> {
    if (value === null || value === '') return ok(value)
    if (typeof value !== 'string') return fail('email: expected string')
    return value.includes('@') ? ok(value) : fail('email: must contain "@"')
  }
  compare(a: TypedValue, b: TypedValue): number {
    return cmpString(a, b)
  }
  castKind(): CastKind {
    return 'text'
  }
  toConfig(): FieldTypeConfig {
    return { kind: 'email' }
  }
}

class UrlFieldType implements FieldType {
  readonly kind = 'url'
  readonly computed = false
  validate(value: Json): Result<TypedValue> {
    if (value === null || value === '') return ok(value)
    if (typeof value !== 'string') return fail('url: expected string')
    return /^https?:\/\/.+/.test(value) ? ok(value) : fail('url: must start with http(s)://')
  }
  compare(a: TypedValue, b: TypedValue): number {
    return cmpString(a, b)
  }
  castKind(): CastKind {
    return 'text'
  }
  toConfig(): FieldTypeConfig {
    return { kind: 'url' }
  }
}

// AI-generated text. Settable like text; carries the generation prompt.
class AiFieldType implements FieldType {
  readonly kind = 'ai'
  readonly computed = false
  constructor(public readonly aiPrompt?: string) {}
  validate(value: Json): Result<TypedValue> {
    if (value === null) return ok(null)
    return typeof value === 'string' ? ok(value) : fail('ai: expected string')
  }
  compare(a: TypedValue, b: TypedValue): number {
    return cmpString(a, b)
  }
  castKind(): CastKind {
    return 'text'
  }
  toConfig(): FieldTypeConfig {
    return { kind: 'ai', ...(this.aiPrompt ? { aiPrompt: this.aiPrompt } : {}) }
  }
}

// Stored as a JSON string OR a JSON value; validated by parseability.
class JsonFieldType implements FieldType {
  readonly kind = 'json'
  readonly computed = false
  validate(value: Json): Result<TypedValue> {
    if (value === null || value === '') return ok(value)
    if (typeof value === 'string') {
      try {
        JSON.parse(value)
        return ok(value)
      } catch {
        return fail('json: must be valid JSON')
      }
    }
    if (isJsonObject(value) || Array.isArray(value)) return ok(value)
    return ok(value)
  }
  compare(a: TypedValue, b: TypedValue): number {
    return cmpString(JSON.stringify(a), JSON.stringify(b))
  }
  castKind(): CastKind {
    return 'text'
  }
  toConfig(): FieldTypeConfig {
    return { kind: 'json' }
  }
}

// Image(s): a URL string, or an array of URL strings. Rendered as thumbnails on
// the read side. Accepts null/empty; no strict URL check (Bling links vary).
class ImageFieldType implements FieldType {
  readonly kind = 'image'
  readonly computed = false
  validate(value: Json): Result<TypedValue> {
    if (value === null || value === '') return ok(value)
    if (typeof value === 'string') return ok(value)
    if (Array.isArray(value) && value.every((v) => typeof v === 'string')) return ok(value)
    return fail('image: expected a URL string or array of URL strings')
  }
  compare(a: TypedValue, b: TypedValue): number {
    return cmpString(a, b)
  }
  castKind(): CastKind {
    return 'text'
  }
  toConfig(): FieldTypeConfig {
    return { kind: 'image' }
  }
}

// Postal address: a structured object (logradouro/numero/complemento/bairro/cep/
// municipio/uf/pais, all optional). Accepts null, an object, or a plain string
// (legacy/loose input). Stored as-is in the record's JSON data.
class AddressFieldType implements FieldType {
  readonly kind = 'address'
  readonly computed = false
  validate(value: Json): Result<TypedValue> {
    if (value === null || value === '') return ok(value)
    if (typeof value === 'string') return ok(value)
    if (isJsonObject(value)) return ok(value)
    return fail('address: expected an object or string')
  }
  compare(a: TypedValue, b: TypedValue): number {
    return cmpString(JSON.stringify(a ?? ''), JSON.stringify(b ?? ''))
  }
  castKind(): CastKind {
    return 'text'
  }
  toConfig(): FieldTypeConfig {
    return { kind: 'address' }
  }
}

// --- numeric family ------------------------------------------------------

class NumberFieldType implements FieldType {
  readonly kind = 'number'
  readonly computed = false
  validate(value: Json): Result<TypedValue> {
    if (value === null) return ok(null)
    return typeof value === 'number' ? ok(value) : fail('number: expected number')
  }
  compare(a: TypedValue, b: TypedValue): number {
    return cmpNumber(a, b)
  }
  castKind(): CastKind {
    return 'numeric'
  }
  toConfig(): FieldTypeConfig {
    return { kind: 'number' }
  }
}

// decimal / currency / percent / duration: numeric, accepting a numeric string
// too (record data often arrives as strings from forms). Carries display config.
class NumericFieldType implements FieldType {
  readonly computed = false
  constructor(
    public readonly kind: string,
    public readonly config: { currencyCode?: string; decimalPlaces?: number } = {},
  ) {}
  validate(value: Json): Result<TypedValue> {
    if (value === null || value === '') return ok(value)
    return isNumeric(value) ? ok(value) : fail(`${this.kind}: expected a number`)
  }
  compare(a: TypedValue, b: TypedValue): number {
    return cmpNumber(a, b)
  }
  castKind(): CastKind {
    return 'numeric'
  }
  toConfig(): FieldTypeConfig {
    const base: Record<string, unknown> = { kind: this.kind }
    if (this.config.currencyCode) base.currencyCode = this.config.currencyCode
    if (this.config.decimalPlaces !== undefined) base.decimalPlaces = this.config.decimalPlaces
    return base as FieldTypeConfig
  }
}

class RatingFieldType implements FieldType {
  readonly kind = 'rating'
  readonly computed = false
  constructor(public readonly maxRating: number = 5) {}
  validate(value: Json): Result<TypedValue> {
    if (value === null || value === '') return ok(value)
    if (!isNumeric(value)) return fail('rating: expected a number')
    const n = Number(value)
    if (n < 0 || n > this.maxRating) return fail(`rating: must be between 0 and ${this.maxRating}`)
    return ok(value)
  }
  compare(a: TypedValue, b: TypedValue): number {
    return cmpNumber(a, b)
  }
  castKind(): CastKind {
    return 'numeric'
  }
  toConfig(): FieldTypeConfig {
    return { kind: 'rating', maxRating: this.maxRating }
  }
}

// --- date family ---------------------------------------------------------

class DateLikeFieldType implements FieldType {
  readonly computed = false
  constructor(public readonly kind: string) {}
  validate(value: Json): Result<TypedValue> {
    if (value === null || value === '') return ok(value)
    if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
      return fail(`${this.kind}: expected an ISO-8601 ${this.kind === 'datetime' ? 'date-time' : 'date'} string`)
    }
    return ok(value)
  }
  compare(a: TypedValue, b: TypedValue): number {
    return cmpDate(a, b)
  }
  castKind(): CastKind {
    return 'date'
  }
  toConfig(): FieldTypeConfig {
    return { kind: this.kind } as FieldTypeConfig
  }
}

// --- boolean -------------------------------------------------------------

class BooleanFieldType implements FieldType {
  readonly kind = 'boolean'
  readonly computed = false
  validate(value: Json): Result<TypedValue> {
    if (value === null || value === '') return ok(value)
    if (typeof value === 'boolean') return ok(value)
    if (value === 'true' || value === 'false') return ok(value === 'true')
    return fail('boolean: expected boolean')
  }
  compare(a: TypedValue, b: TypedValue): number {
    return Number(a === true) - Number(b === true)
  }
  castKind(): CastKind {
    return 'text'
  }
  toConfig(): FieldTypeConfig {
    return { kind: 'boolean' }
  }
}

// --- choice family -------------------------------------------------------

class SelectFieldType implements FieldType {
  readonly computed = false
  constructor(
    public readonly kind: 'select' | 'status' | 'priority',
    public readonly options: readonly EntityFieldOption[],
  ) {}
  private values(): string[] {
    return this.options.map((o) => o.value)
  }
  validate(value: Json): Result<TypedValue> {
    if (value === null || value === '') return ok(value)
    const opts = this.values()
    if (opts.length === 0) return ok(value)
    return opts.includes(String(value))
      ? ok(value)
      : fail(`${this.kind}: must be one of [${opts.join(', ')}]`)
  }
  compare(a: TypedValue, b: TypedValue): number {
    return this.values().indexOf(String(a)) - this.values().indexOf(String(b))
  }
  castKind(): CastKind {
    return 'text'
  }
  toConfig(): FieldTypeConfig {
    return { kind: this.kind, options: this.options.map((o) => ({ ...o })) }
  }
}

class MultiSelectFieldType implements FieldType {
  readonly kind = 'multiselect'
  readonly computed = false
  constructor(public readonly options: readonly EntityFieldOption[]) {}
  validate(value: Json): Result<TypedValue> {
    if (value === null || value === '') return ok(value)
    const opts = this.options.map((o) => o.value)
    if (opts.length === 0) return ok(value)
    const values = String(value)
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
    for (const v of values) {
      if (!opts.includes(v)) return fail(`multiselect: "${v}" is not a valid option`)
    }
    return ok(value)
  }
  compare(a: TypedValue, b: TypedValue): number {
    return cmpString(a, b)
  }
  castKind(): CastKind {
    return 'text'
  }
  toConfig(): FieldTypeConfig {
    return { kind: 'multiselect', options: this.options.map((o) => ({ ...o })) }
  }
}

// --- relation ------------------------------------------------------------

// Value is the id of a record in another entity. Existence of the target is a
// cross-aggregate concern, checked by the application service (InsertRecord),
// not here — aggregates reference each other by id only.
class RelationFieldType implements FieldType {
  readonly kind = 'relation'
  readonly computed = false
  constructor(
    public readonly targetEntityId: string,
    public readonly targetEntityName?: string,
    public readonly config: {
      labelFieldId?: string
      multiple?: boolean
    } = {},
  ) {}
  validate(value: Json): Result<TypedValue> {
    if (value === null) return ok(null)
    // multiple relation: an array of target ids. A lone string is coerced to a
    // single-element array for convenience. Non-string members are rejected.
    if (this.config.multiple) {
      if (typeof value === 'string') return value ? ok([value]) : ok(null)
      if (Array.isArray(value) && value.every((v) => typeof v === 'string')) return ok(value)
      return fail('relation (multiple): expected an array of record ids')
    }
    return typeof value === 'string' ? ok(value) : fail('relation: expected record id (string)')
  }
  compare(a: TypedValue, b: TypedValue): number {
    // arrays (multiple) don't order meaningfully; compare by their string form.
    if (Array.isArray(a) || Array.isArray(b)) return cmpString(JSON.stringify(a ?? []), JSON.stringify(b ?? []))
    return cmpString(a, b)
  }
  castKind(): CastKind {
    return 'text'
  }
  toConfig(): FieldTypeConfig {
    return {
      kind: 'relation',
      targetEntityId: this.targetEntityId,
      ...(this.targetEntityName ? { targetEntityName: this.targetEntityName } : {}),
      ...(this.config.labelFieldId ? { labelFieldId: this.config.labelFieldId } : {}),
      ...(this.config.multiple ? { multiple: true } : {}),
    }
  }
}

// --- computed / derived --------------------------------------------------

// lookup / rollup / autonumber: the user cannot set them (derived). The hex
// domain does not resolve lookup/rollup at write time (AEX resolves them on the
// read side); the schema simply skips them. Setting one is rejected.
class DerivedFieldType implements FieldType {
  readonly computed = true
  constructor(
    public readonly kind: string,
    public readonly config: { viaFieldId?: string; lookupFieldId?: string; rollupFunction?: string } = {},
  ) {}
  validate(value: Json): Result<TypedValue> {
    if (value === null) return ok(null)
    return fail(`${this.kind}: computed field cannot be set manually`)
  }
  compare(a: TypedValue, b: TypedValue): number {
    return cmpString(a, b)
  }
  castKind(): CastKind {
    return this.kind === 'autonumber' ? 'numeric' : 'text'
  }
  toConfig(): FieldTypeConfig {
    const base: Record<string, unknown> = { kind: this.kind }
    if (this.config.viaFieldId) base.viaFieldId = this.config.viaFieldId
    if (this.config.lookupFieldId) base.lookupFieldId = this.config.lookupFieldId
    if (this.config.rollupFunction) base.rollupFunction = this.config.rollupFunction
    return base as FieldTypeConfig
  }
}

// Computed: the user cannot set it. RecordSchema evaluates the formula and
// injects the value during validation.
class FormulaFieldType implements FieldType {
  readonly kind = 'formula'
  readonly computed = true
  constructor(public readonly formula: Formula) {}
  validate(value: Json): Result<TypedValue> {
    if (value === null) return ok(null)
    if (typeof value === 'number') return ok(value)
    return fail('formula: computed field cannot be set manually')
  }
  compare(a: TypedValue, b: TypedValue): number {
    return cmpNumber(a, b)
  }
  castKind(): CastKind {
    return 'numeric'
  }
  toConfig(): FieldTypeConfig {
    return { kind: 'formula', expression: this.formula.source }
  }
}

// created_at / updated_at / created_by / updated_by: server-managed. AEX
// tolerates a client value but overwrites it; the application service injects the
// real value (populateSystemFields). The schema skips them (computed) so they are
// never required and never validated against client input.
class SystemFieldType implements FieldType {
  readonly computed = true
  constructor(public readonly kind: 'created_at' | 'updated_at' | 'created_by' | 'updated_by') {}
  validate(value: Json): Result<TypedValue> {
    return ok(value)
  }
  compare(a: TypedValue, b: TypedValue): number {
    return this.castKind() === 'date' ? cmpDate(a, b) : cmpString(a, b)
  }
  castKind(): CastKind {
    return this.kind === 'created_at' || this.kind === 'updated_at' ? 'date' : 'text'
  }
  toConfig(): FieldTypeConfig {
    return { kind: this.kind }
  }
}

// Reconstructs a FieldType strategy from its persisted descriptor. The switch is
// exhaustive over a CLOSED set: adding a new field type is a CODE change here,
// never user data. `availableFields` lets a formula validate its references.
export const FieldTypeFactory = {
  create(config: FieldTypeConfig, availableFields: readonly string[]): Result<FieldType> {
    switch (config.kind) {
      case 'text':
        return ok(new TextFieldType())
      case 'long_text':
      case 'rich_text':
      case 'phone':
      case 'person':
      case 'barcode':
      case 'attachment':
        return ok(new FreeTextFieldType(config.kind))
      case 'email':
        return ok(new EmailFieldType())
      case 'url':
        return ok(new UrlFieldType())
      case 'image':
        return ok(new ImageFieldType())
      case 'address':
        return ok(new AddressFieldType())
      case 'ai':
        return ok(new AiFieldType(config.aiPrompt))
      case 'json':
        return ok(new JsonFieldType())
      case 'number':
        return ok(new NumberFieldType())
      case 'decimal':
        return ok(new NumericFieldType('decimal', { decimalPlaces: config.decimalPlaces }))
      case 'currency':
        return ok(
          new NumericFieldType('currency', {
            currencyCode: config.currencyCode,
            decimalPlaces: config.decimalPlaces,
          }),
        )
      case 'percent':
        return ok(new NumericFieldType('percent', { decimalPlaces: config.decimalPlaces }))
      case 'duration':
        return ok(new NumericFieldType('duration'))
      case 'rating':
        return ok(new RatingFieldType(config.maxRating ?? 5))
      case 'date':
      case 'datetime':
        return ok(new DateLikeFieldType(config.kind))
      case 'boolean':
        return ok(new BooleanFieldType())
      case 'select':
      case 'status':
      case 'priority':
        return ok(new SelectFieldType(config.kind, config.options ?? []))
      case 'multiselect':
        return ok(new MultiSelectFieldType(config.options ?? []))
      case 'relation':
        return ok(
          new RelationFieldType(config.targetEntityId, config.targetEntityName, {
            labelFieldId: config.labelFieldId,
            multiple: config.multiple,
          }),
        )
      case 'lookup':
        return ok(
          new DerivedFieldType('lookup', {
            viaFieldId: config.viaFieldId,
            lookupFieldId: config.lookupFieldId,
          }),
        )
      case 'rollup':
        return ok(
          new DerivedFieldType('rollup', {
            viaFieldId: config.viaFieldId,
            lookupFieldId: config.lookupFieldId,
            rollupFunction: config.rollupFunction,
          }),
        )
      case 'autonumber':
        return ok(new DerivedFieldType('autonumber'))
      case 'formula': {
        const formula = Formula.parse(config.expression, availableFields)
        if (!formula.ok) return formula
        return ok(new FormulaFieldType(formula.value))
      }
      case 'created_at':
      case 'updated_at':
      case 'created_by':
      case 'updated_by':
        return ok(new SystemFieldType(config.kind))
    }
  },
}

export { FormulaFieldType, RelationFieldType, SelectFieldType, SystemFieldType, DerivedFieldType }
