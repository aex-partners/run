// PURE declarative model of the costing data model. No IO. The provisioning
// script maps these specs onto data-context CreateEntity/AddField in-ports.

import { EntitySpec, FieldSpec, fieldConfig } from '@/scripts/schemaSpec'
export { fieldConfig }
export type { EntitySpec, FieldSpec }

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
