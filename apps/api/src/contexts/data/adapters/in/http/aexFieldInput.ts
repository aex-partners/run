import { randomUUID } from 'node:crypto'
import { Slug } from '@/contexts/data/domain/Slug'
import { FieldTypeConfig } from '@/contexts/data/domain/FieldType'
import { AexField, AexFieldCodec } from '@/contexts/data/application/mappers/AexFieldCodec'
import { FieldDefinitionInput } from '@/contexts/data/application/ports/in/FieldDefinitionInput'

// The AEX-shaped field definition that arrives over tRPC (type as a string +
// flat config). Mirrors entities.ts's fieldConfigShape.
export interface AexFieldInput {
  id?: string
  name: string
  type: string
  required?: boolean
  unique?: boolean
  description?: string
  defaultValue?: string
  options?: { value: string; label: string; color?: string }[]
  formula?: string
  relationshipEntityId?: string
  relationshipEntityName?: string
  labelFieldId?: string
  multiple?: boolean
  viaFieldId?: string
  lookupFieldId?: string
  rollupFunction?: string
  currencyCode?: string
  aiPrompt?: string
  maxRating?: number
  decimalPlaces?: number
}

const slugFor = (name: string): string => {
  const slug = Slug.from(name)
  return slug.isEmpty() ? `field_${randomUUID().slice(0, 8)}` : slug.value
}

// Translate AEX field input -> the domain's plain FieldDefinitionInput. The
// driving adapter owns id generation and slug derivation.
export function toFieldDefinitionInput(raw: AexFieldInput): FieldDefinitionInput {
  const id = raw.id ?? randomUUID()
  const slug = slugFor(raw.name)
  const aex: AexField = {
    id,
    name: raw.name,
    slug,
    type: raw.type,
    required: raw.required ?? false,
    unique: raw.unique,
    description: raw.description,
    defaultValue: raw.defaultValue,
    options: raw.options,
    formula: raw.formula,
    relationshipEntityId: raw.relationshipEntityId,
    relationshipEntityName: raw.relationshipEntityName,
    labelFieldId: raw.labelFieldId,
    multiple: raw.multiple,
    viaFieldId: raw.viaFieldId,
    lookupFieldId: raw.lookupFieldId,
    rollupFunction: raw.rollupFunction,
    currencyCode: raw.currencyCode,
    aiPrompt: raw.aiPrompt,
    maxRating: raw.maxRating,
    decimalPlaces: raw.decimalPlaces,
  }
  const d = AexFieldCodec.toDescriptor(aex)
  return {
    id,
    name: d.name,
    displayName: raw.name,
    required: d.required,
    unique: raw.unique,
    description: raw.description,
    defaultValue: raw.defaultValue,
    type: d.type,
  }
}

// Build only the FieldTypeConfig for a field-update patch where the type changed.
export function toFieldTypeConfig(raw: AexFieldInput): FieldTypeConfig {
  return toFieldDefinitionInput(raw).type
}
