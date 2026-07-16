// Política comercial + tabela de preços. Todo displayName slugifica exatamente no slug
// declarado (travado pelo teste): o provisionamento pula por slug.
import { EntitySpec, FieldSpec } from '@/scripts/schemaSpec'

export const PRECIFICACAO_ENTITIES: EntitySpec[] = [
  {
    slug: 'canais_de_venda',
    displayName: 'Canais de Venda',
    fields: [
      { slug: 'nome', displayName: 'Nome', kind: 'text' },
      { slug: 'comissao', displayName: 'Comissao', kind: 'percent' },   // 0,10 = 10%
      { slug: 'frete', displayName: 'Frete', kind: 'percent' },
      { slug: 'ativo', displayName: 'Ativo', kind: 'boolean' },
    ],
  },
  {
    // Linha única, global. Sem linha = imposto/iss zero (o serviço avisa).
    slug: 'parametros_de_preco',
    displayName: 'Parâmetros de Preço',
    fields: [
      { slug: 'imposto', displayName: 'Imposto', kind: 'percent' },     // Simples 0,0333
      { slug: 'iss', displayName: 'Iss', kind: 'percent' },
    ],
  },
  {
    // A escolha do lucro por modelo × canal. Todos os SKUs do modelo herdam.
    slug: 'politica_de_preco',
    displayName: 'Política de Preço',
    fields: [
      { slug: 'modelo', displayName: 'Modelo', kind: 'relation', targetSlug: 'modelos' },
      { slug: 'canal', displayName: 'Canal', kind: 'relation', targetSlug: 'canais_de_venda' },
      { slug: 'lucro_alvo', displayName: 'Lucro alvo', kind: 'percent' },
    ],
  },
  {
    // A TABELA GRAVADA. Uma linha por (sku, canal, condição). Carrega o custo-base e os
    // componentes usados: o histórico se explica sem recalcular (igual ao snapshot de custo).
    slug: 'precos_de_venda',
    displayName: 'Preços de Venda',
    fields: [
      { slug: 'sku', displayName: 'Sku', kind: 'relation', targetSlug: 'produtos' },
      { slug: 'canal', displayName: 'Canal', kind: 'relation', targetSlug: 'canais_de_venda' },
      { slug: 'condicao', displayName: 'Condicao', kind: 'relation', targetSlug: 'condicoes_pagamento' },
      { slug: 'preco', displayName: 'Preco', kind: 'currency' },
      { slug: 'lucro_usado', displayName: 'Lucro usado', kind: 'percent' },
      { slug: 'custo_base', displayName: 'Custo base', kind: 'currency', decimalPlaces: 4 },
      { slug: 'componentes', displayName: 'Componentes', kind: 'long_text' },   // JSON dos %
      { slug: 'data', displayName: 'Data', kind: 'datetime' },
    ],
  },
]

// Acrescentado a `condicoes_pagamento` (que já existe, do espelho do Bling). É a alavanca
// da tabela por condição de pagamento: à vista 0, 30d 0,02, 30/60 mais.
export const CONDICOES_PRECO_FIELDS: FieldSpec[] = [
  { slug: 'desp_financeira', displayName: 'Despesa financeira', kind: 'percent' },
]
