// PURE declarative model of the costing data model. No IO. The provisioning
// script maps these specs onto data-context CreateEntity/AddField in-ports.

export interface FieldSpec {
  slug: string
  displayName: string
  // one of: text | long_text | number | currency | boolean | relation | date | select
  kind: string
  targetSlug?: string   // for kind 'relation': the target entity slug
  multiple?: boolean    // for kind 'relation'
  options?: string[]    // for kind 'select'
}

export interface EntitySpec {
  slug: string
  displayName: string
  fields: FieldSpec[]
}

export const PRODUTOS_NEW_FIELDS: FieldSpec[] = [
  { slug: 'fantasma', displayName: 'Produto fantasma', kind: 'boolean' },
  { slug: 'resolve_por', displayName: 'Resolve por', kind: 'relation', targetSlug: 'tipos_de_variacao' },
]

export const VARIACOES_NEW_FIELDS: FieldSpec[] = [
  { slug: 'fator_qtd', displayName: 'Fator de quantidade (%)', kind: 'number' },
]

export const COSTING_ENTITIES: EntitySpec[] = [
  {
    slug: 'substituicoes',
    displayName: 'Substituições',
    fields: [
      { slug: 'variacao', displayName: 'Variação', kind: 'relation', targetSlug: 'variacoes' },
      { slug: 'de_item', displayName: 'De (fantasma)', kind: 'relation', targetSlug: 'produtos' },
      { slug: 'para_item', displayName: 'Para (real)', kind: 'relation', targetSlug: 'produtos' },
    ],
  },
  {
    slug: 'fichas_tecnicas',
    displayName: 'Fichas Técnicas',
    fields: [
      { slug: 'modelo', displayName: 'Modelo', kind: 'relation', targetSlug: 'modelos' },
      { slug: 'item', displayName: 'Item', kind: 'relation', targetSlug: 'produtos' },
      { slug: 'unidade', displayName: 'Unidade', kind: 'text' },
      { slug: 'qty_base', displayName: 'Qtd base', kind: 'number' },
      { slug: 'qty_por_tamanho', displayName: 'Qtd por tamanho', kind: 'long_text' },
      { slug: 'rev', displayName: 'Revisão', kind: 'number' },
      { slug: 'status', displayName: 'Status', kind: 'select', options: ['rascunho', 'publicada'] },
    ],
  },
  {
    slug: 'fichas_explodidas',
    displayName: 'Fichas Explodidas',
    fields: [
      { slug: 'sku', displayName: 'SKU', kind: 'relation', targetSlug: 'produtos' },
      { slug: 'item', displayName: 'Item', kind: 'relation', targetSlug: 'produtos' },
      { slug: 'qty', displayName: 'Qtd', kind: 'number' },
      { slug: 'custo_unit', displayName: 'Custo unit.', kind: 'currency' },
      { slug: 'custo_total', displayName: 'Custo total', kind: 'currency' },
      { slug: 'origem_rev', displayName: 'Revisão de origem', kind: 'number' },
      { slug: 'editado_manual', displayName: 'Editado manual', kind: 'boolean' },
    ],
  },
  {
    slug: 'snapshots_custo',
    displayName: 'Snapshots Custo',
    fields: [
      { slug: 'sku', displayName: 'SKU', kind: 'relation', targetSlug: 'produtos' },
      { slug: 'data', displayName: 'Data', kind: 'datetime' },
      { slug: 'custo_total', displayName: 'Custo total', kind: 'currency' },
      { slug: 'origem_rev', displayName: 'Revisão de origem', kind: 'number' },
      { slug: 'detalhe', displayName: 'Detalhe', kind: 'long_text' },
    ],
  },
]

// Maps a FieldSpec to the data-context FieldTypeConfig. `resolveEntityId` turns a
// target slug into its entity id (null if the entity does not exist yet).
export function fieldConfig(
  spec: FieldSpec,
  resolveEntityId: (slug: string) => string | null,
): Record<string, unknown> {
  switch (spec.kind) {
    case 'boolean': return { kind: 'boolean' }
    case 'number': return { kind: 'number' }
    case 'text': return { kind: 'text' }
    case 'long_text': return { kind: 'long_text' }
    case 'date': return { kind: 'date' }
    case 'datetime': return { kind: 'datetime' }
    case 'currency': return { kind: 'currency', currencyCode: 'BRL' }
    case 'select': return { kind: 'select', options: (spec.options ?? []).map((o) => ({ value: o, label: o })) }
    case 'relation': {
      const targetEntityId = spec.targetSlug ? resolveEntityId(spec.targetSlug) : null
      if (!targetEntityId) throw new Error(`relation target not found: ${spec.targetSlug}`)
      return spec.multiple
        ? { kind: 'relation', targetEntityId, multiple: true }
        : { kind: 'relation', targetEntityId }
    }
    default: throw new Error(`unknown field kind: ${spec.kind}`)
  }
}
