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
  {
    slug: 'parametros_de_custo',
    displayName: 'Parâmetros de Custo',
    fields: [
      { slug: 'chave', displayName: 'Chave', kind: 'select',
        options: ['taxa_fixa_min', 'taxa_moi_min', 'taxa_depreciacao_min'] },
      // nulo = taxa global; preenchido = taxa específica daquele centro (sobrepõe a global)
      { slug: 'escopo_centro', displayName: 'Escopo centro', kind: 'relation', targetSlug: 'centros_de_trabalho' },
      { slug: 'valor', displayName: 'Valor', kind: 'currency', decimalPlaces: 4 },
      { slug: 'vigencia_inicio', displayName: 'Vigencia inicio', kind: 'date' },
      { slug: 'vigencia_fim', displayName: 'Vigencia fim', kind: 'date' },  // nulo = aberta
    ],
  },
  {
    slug: 'custos_de_operacao',
    displayName: 'Custos de Operação',
    fields: [
      { slug: 'sku', displayName: 'SKU', kind: 'relation', targetSlug: 'produtos' },
      // A linha CUSTEADA daquela revisão: aponta para a LINHA de `operacoes` que foi custeada
      // (a instância da revisão). Correto justamente por ser presa à revisão — o custo é o
      // retrato daquela rev. O `codigo` vem junto só para leitura humana.
      { slug: 'operacao', displayName: 'Operacao', kind: 'relation', targetSlug: 'operacoes' },
      { slug: 'codigo', displayName: 'Codigo', kind: 'text' },
      { slug: 'centro', displayName: 'Centro', kind: 'relation', targetSlug: 'centros_de_trabalho' },
      { slug: 'tempo_min', displayName: 'Tempo min', kind: 'duration' },
      { slug: 'custo_mod', displayName: 'Custo MOD', kind: 'currency' },
      { slug: 'custo_indireto', displayName: 'Custo indireto', kind: 'currency' },
      { slug: 'custo_total', displayName: 'Custo total', kind: 'currency' },
      { slug: 'origem_rev', displayName: 'Origem rev', kind: 'number' },
    ],
  },
]

// A linha da ficha aponta para a operação que CONSOME aquele insumo. Nulo = ainda não atribuído.
//
// Aponta para o CÓDIGO da operação (operacoes.codigo), NÃO para a linha da revisão. Uma relação
// à linha penduraria no vazio assim que uma nova revisão do roteiro fosse publicada: cada revisão
// cria linhas NOVAS de `operacoes` e as antigas deixam de ser a revisão vigente. O código é a
// identidade estável da operação dentro do modelo e sobrevive a toda revisão.
export const FICHAS_TECNICAS_NEW_FIELDS: FieldSpec[] = [
  { slug: 'operacao_codigo', displayName: 'Operacao codigo', kind: 'text' },
]
export const FICHAS_EXPLODIDAS_NEW_FIELDS: FieldSpec[] = [
  { slug: 'operacao_codigo', displayName: 'Operacao codigo', kind: 'text' },
]
// snapshots_custo.custo_total passa a ser o custo CHEIO. Seguro: prod tem 0 snapshots.
export const SNAPSHOTS_NEW_FIELDS: FieldSpec[] = [
  { slug: 'custo_materiais', displayName: 'Custo materiais', kind: 'currency' },
  { slug: 'custo_mod', displayName: 'Custo MOD', kind: 'currency' },
  { slug: 'custo_indireto', displayName: 'Custo indireto', kind: 'currency' },
  { slug: 'tempo_total_min', displayName: 'Tempo total min', kind: 'duration' },
  { slug: 'origem_rev_roteiro', displayName: 'Origem rev roteiro', kind: 'number' },
  { slug: 'detalhe_conversao', displayName: 'Detalhe conversao', kind: 'long_text' },
]
// preco_custo continua = MATERIAIS (semântica Bling). O custo cheio é custo_unitario_total.
export const PRODUTOS_CUSTO_FIELDS: FieldSpec[] = [
  { slug: 'custo_conversao', displayName: 'Custo conversao', kind: 'currency' },
  { slug: 'custo_unitario_total', displayName: 'Custo unitario total', kind: 'currency' },
  { slug: 'tempo_total_min', displayName: 'Tempo total min', kind: 'duration' },
]
