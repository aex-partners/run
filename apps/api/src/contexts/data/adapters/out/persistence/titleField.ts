import { Field } from '@/contexts/data/domain/Field'

// The TITLE (display) field of each seeded Buenaça entity, by entity NAME. The
// relation display resolves an id to this field's value. Encoded here (the domain
// has no notion of a primary field) so the read side owns the label mapping.
// Shared by DrizzleResolveLabels (id -> label) and DrizzleListOptions (picker).
export const TITLE_FIELD_BY_ENTITY: Readonly<Record<string, string>> = {
  Contatos: 'Nome',
  Produtos: 'Descrição',
  Estoque: 'Descrição Produto',
  'Pedidos de Venda': 'Número pedido',
  'Contas a Receber': 'Cliente',
  'Contas a Pagar': 'Fornecedor',
}

// Fallback when the entity has no mapped title: first required text field, else
// first text field, else first field. Mirrors DrizzleSearchRecords' labelFieldFor.
export const fallbackLabelField = (fields: readonly Field[]): Field | undefined =>
  fields.find((f) => f.type.kind === 'text' && f.required) ??
  fields.find((f) => f.type.kind === 'text') ??
  fields[0]

// Resolve the slug (JSON data key) of the entity's title field: match the mapped
// display name (case-insensitive) against each field's displayName/slug.
export const titleSlugFor = (entityName: string, fields: readonly Field[]): string | undefined => {
  const wanted = TITLE_FIELD_BY_ENTITY[entityName]
  if (wanted) {
    const target = wanted.toLowerCase()
    const hit = fields.find(
      (f) => (f.meta.displayName ?? '').toLowerCase() === target || f.name.value.toLowerCase() === target,
    )
    if (hit) return hit.name.value
  }
  return fallbackLabelField(fields)?.name.value
}
