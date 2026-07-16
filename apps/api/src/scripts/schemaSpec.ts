// PURE declarative schema vocabulary shared by every provisioning script.
// Maps a FieldSpec onto the data-context FieldTypeConfig (data/domain/FieldType.ts).

export interface FieldSpec {
  slug: string
  displayName: string
  // text | long_text | number | decimal | percent | boolean | date | datetime | duration | currency | select | relation
  kind: string
  targetSlug?: string    // kind 'relation': target entity slug
  multiple?: boolean     // kind 'relation'
  options?: string[]     // kind 'select'
  decimalPlaces?: number // kind 'currency' | 'decimal' | 'percent'
}

export interface EntitySpec {
  slug: string
  displayName: string
  fields: FieldSpec[]
}

// `resolveEntityId` turns a target slug into its entity id (null when absent).
export function fieldConfig(
  spec: FieldSpec,
  resolveEntityId: (slug: string) => string | null,
): Record<string, unknown> {
  switch (spec.kind) {
    case 'boolean': return { kind: 'boolean' }
    case 'number': return { kind: 'number' }
    // Quantidade de estoque é FRACIONÁRIA (1,3 mt de tecido). `number` arredondaria.
    case 'decimal':
      return spec.decimalPlaces == null
        ? { kind: 'decimal' }
        : { kind: 'decimal', decimalPlaces: spec.decimalPlaces }
    // percent é FRAÇÃO (0,10 = 10%). Numérico como decimal/currency.
    case 'percent':
      return spec.decimalPlaces == null
        ? { kind: 'percent' }
        : { kind: 'percent', decimalPlaces: spec.decimalPlaces }
    case 'text': return { kind: 'text' }
    case 'long_text': return { kind: 'long_text' }
    case 'date': return { kind: 'date' }
    case 'datetime': return { kind: 'datetime' }
    // NOTE: `duration` is a bare number in the data context. Unit is ALWAYS minutes,
    // enforced by the mandatory `_min` suffix on every time field's slug.
    case 'duration': return { kind: 'duration' }
    case 'currency':
      return spec.decimalPlaces == null
        ? { kind: 'currency', currencyCode: 'BRL' }
        : { kind: 'currency', currencyCode: 'BRL', decimalPlaces: spec.decimalPlaces }
    case 'select':
      return { kind: 'select', options: (spec.options ?? []).map((o) => ({ value: o, label: o })) }
    case 'relation': {
      const targetEntityId = spec.targetSlug ? resolveEntityId(spec.targetSlug) : null
      if (!targetEntityId) throw new Error(`relation target not found: ${spec.targetSlug}`)
      return spec.multiple
        ? { kind: 'relation', targetEntityId, multiple: true }
        : { kind: 'relation', targetEntityId }
    }
    default:
      throw new Error(`unknown field kind: ${spec.kind}`)
  }
}
