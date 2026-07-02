import { Field } from '@/contexts/data/domain/Field'
import { FieldDescriptor } from '@/contexts/data/domain/EntityDefinition'
import { EntityFieldOption, FieldTypeConfig } from '@/contexts/data/domain/FieldType'

// The exact JSON shape AEX stores in `entities.fields` (a JSON text column). The
// codec is the single place that knows it: it translates between this on-disk
// shape and the domain's FieldDescriptor / FieldTypeConfig. Pure (no npm, no IO).
export interface AexField {
  id: string
  name: string
  slug: string
  type: string
  required: boolean
  unique?: boolean
  description?: string
  defaultValue?: string
  options?: EntityFieldOption[]
  formula?: string
  relationshipEntityId?: string
  relationshipEntityName?: string
  viaFieldId?: string
  lookupFieldId?: string
  rollupFunction?: string
  currencyCode?: string
  aiPrompt?: string
  maxRating?: number
  decimalPlaces?: number
}

// AEX type strings whose domain kind differs from the literal string.
const toDomainKind = (aexType: string): string => {
  if (aexType === 'checkbox') return 'boolean'
  if (aexType === 'relationship') return 'relation'
  return aexType
}
const toAexType = (kind: string): string => {
  if (kind === 'boolean') return 'checkbox'
  if (kind === 'relation') return 'relationship'
  return kind
}

const migrateOptions = (options: unknown): EntityFieldOption[] | undefined => {
  if (!Array.isArray(options) || options.length === 0) return undefined
  if (typeof options[0] === 'string') {
    return (options as string[]).map((s) => ({ value: s, label: s }))
  }
  return options as EntityFieldOption[]
}

// Build the domain FieldTypeConfig from an AEX field's flat attributes.
const configOf = (f: AexField): FieldTypeConfig => {
  const kind = toDomainKind(f.type)
  switch (kind) {
    case 'select':
    case 'status':
    case 'priority':
      return { kind, options: f.options ?? [] }
    case 'multiselect':
      return { kind: 'multiselect', options: f.options ?? [] }
    case 'currency':
      return {
        kind: 'currency',
        ...(f.currencyCode ? { currencyCode: f.currencyCode } : {}),
        ...(f.decimalPlaces !== undefined ? { decimalPlaces: f.decimalPlaces } : {}),
      }
    case 'decimal':
    case 'percent':
      return { kind, ...(f.decimalPlaces !== undefined ? { decimalPlaces: f.decimalPlaces } : {}) }
    case 'rating':
      return { kind: 'rating', ...(f.maxRating !== undefined ? { maxRating: f.maxRating } : {}) }
    case 'ai':
      return { kind: 'ai', ...(f.aiPrompt ? { aiPrompt: f.aiPrompt } : {}) }
    case 'relation':
      return {
        kind: 'relation',
        targetEntityId: f.relationshipEntityId ?? '',
        ...(f.relationshipEntityName ? { targetEntityName: f.relationshipEntityName } : {}),
      }
    case 'lookup':
      return {
        kind: 'lookup',
        ...(f.viaFieldId ? { viaFieldId: f.viaFieldId } : {}),
        ...(f.lookupFieldId ? { lookupFieldId: f.lookupFieldId } : {}),
      }
    case 'rollup':
      return {
        kind: 'rollup',
        ...(f.viaFieldId ? { viaFieldId: f.viaFieldId } : {}),
        ...(f.lookupFieldId ? { lookupFieldId: f.lookupFieldId } : {}),
        ...(f.rollupFunction ? { rollupFunction: f.rollupFunction } : {}),
      }
    case 'formula':
      return { kind: 'formula', expression: f.formula ?? '' }
    default:
      return { kind } as FieldTypeConfig
  }
}

export const AexFieldCodec = {
  // One AEX field object -> the domain FieldDescriptor (slug is the JSON key).
  toDescriptor(f: AexField): FieldDescriptor {
    return {
      name: f.slug,
      required: f.required ?? false,
      type: configOf({ ...f, options: migrateOptions(f.options) }),
      id: f.id,
      displayName: f.name,
      description: f.description,
      unique: f.unique,
      defaultValue: f.defaultValue,
    }
  },

  // Parse the whole AEX `entities.fields` JSON text into FieldDescriptors.
  parse(fieldsJson: string): FieldDescriptor[] {
    try {
      const raw = JSON.parse(fieldsJson) as AexField[]
      return raw.map((f) => this.toDescriptor(f))
    } catch {
      return []
    }
  },

  // A domain Field -> its AEX JSON object (the reverse of toDescriptor).
  toAex(field: Field): AexField {
    const config = field.type.toConfig()
    const slug = field.name.value
    const out: AexField = {
      id: field.meta.id ?? slug,
      name: field.meta.displayName ?? slug,
      slug,
      type: toAexType(config.kind),
      required: field.required,
    }
    if (field.meta.unique) out.unique = true
    if (field.meta.description) out.description = field.meta.description
    if (field.meta.defaultValue) out.defaultValue = field.meta.defaultValue

    switch (config.kind) {
      case 'select':
      case 'status':
      case 'priority':
      case 'multiselect':
        out.options = config.options
        break
      case 'currency':
        if (config.currencyCode) out.currencyCode = config.currencyCode
        if (config.decimalPlaces !== undefined) out.decimalPlaces = config.decimalPlaces
        break
      case 'decimal':
      case 'percent':
        if (config.decimalPlaces !== undefined) out.decimalPlaces = config.decimalPlaces
        break
      case 'rating':
        if (config.maxRating !== undefined) out.maxRating = config.maxRating
        break
      case 'ai':
        if (config.aiPrompt) out.aiPrompt = config.aiPrompt
        break
      case 'relation':
        out.relationshipEntityId = config.targetEntityId
        if (config.targetEntityName) out.relationshipEntityName = config.targetEntityName
        break
      case 'lookup':
        if (config.viaFieldId) out.viaFieldId = config.viaFieldId
        if (config.lookupFieldId) out.lookupFieldId = config.lookupFieldId
        break
      case 'rollup':
        if (config.viaFieldId) out.viaFieldId = config.viaFieldId
        if (config.lookupFieldId) out.lookupFieldId = config.lookupFieldId
        if (config.rollupFunction) out.rollupFunction = config.rollupFunction
        break
      case 'formula':
        out.formula = config.expression
        break
    }
    return out
  },

  serialize(fields: readonly Field[]): string {
    return JSON.stringify(fields.map((f) => this.toAex(f)))
  },
}
