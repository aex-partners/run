// Documentos de compra: pedido, nota de entrada, e a política que decide o que compõe
// o custo. Todo displayName slugifica exatamente no slug declarado (travado pelo teste).
import { EntitySpec } from '@/scripts/schemaSpec'

export const COMPRAS_ENTITIES: EntitySpec[] = [
  {
    slug: 'pedidos_de_compra',
    displayName: 'Pedidos de Compra',
    fields: [
      { slug: 'numero', displayName: 'Numero', kind: 'text' },
      { slug: 'fornecedor', displayName: 'Fornecedor', kind: 'relation', targetSlug: 'pessoas' },
      { slug: 'data', displayName: 'Data', kind: 'date' },
      { slug: 'previsao_entrega', displayName: 'Previsao de entrega', kind: 'date' },
      { slug: 'status', displayName: 'Status', kind: 'select',
        options: ['rascunho', 'enviado', 'parcial', 'recebido', 'cancelado'] },
      { slug: 'valor_total', displayName: 'Valor total', kind: 'currency' },
      { slug: 'observacao', displayName: 'Observacao', kind: 'long_text' },
    ],
  },
  {
    slug: 'itens_pedido_compra',
    displayName: 'Itens Pedido Compra',
    fields: [
      { slug: 'pedido', displayName: 'Pedido', kind: 'relation', targetSlug: 'pedidos_de_compra' },
      { slug: 'insumo', displayName: 'Insumo', kind: 'relation', targetSlug: 'produtos' },
      // Em unidade de COMPRA (é o que o fornecedor fatura).
      { slug: 'qtd', displayName: 'Qtd', kind: 'decimal', decimalPlaces: 4 },
      { slug: 'preco_unitario', displayName: 'Preco unitario', kind: 'currency', decimalPlaces: 4 },
      // Mantida pelo motor a cada nota lançada contra este pedido.
      { slug: 'qtd_recebida', displayName: 'Qtd recebida', kind: 'decimal', decimalPlaces: 4 },
    ],
  },
  {
    // A NOTA É QUEM RECEBE: não existe etapa de recebimento físico separada. Lançar a
    // nota move o estoque E define o custo. `pedido` é NULO permitido: compra direta,
    // sem pedido, é normal.
    slug: 'notas_de_entrada',
    displayName: 'Notas de Entrada',
    fields: [
      { slug: 'numero', displayName: 'Numero', kind: 'text' },
      { slug: 'serie', displayName: 'Serie', kind: 'text' },
      { slug: 'fornecedor', displayName: 'Fornecedor', kind: 'relation', targetSlug: 'pessoas' },
      { slug: 'pedido', displayName: 'Pedido', kind: 'relation', targetSlug: 'pedidos_de_compra' },
      { slug: 'data_emissao', displayName: 'Data de emissao', kind: 'date' },
      { slug: 'data_entrada', displayName: 'Data de entrada', kind: 'date' },
      { slug: 'deposito', displayName: 'Deposito', kind: 'relation', targetSlug: 'depositos' },
      { slug: 'valor_produtos', displayName: 'Valor produtos', kind: 'currency' },
      { slug: 'valor_frete', displayName: 'Valor frete', kind: 'currency' },
      { slug: 'valor_desconto', displayName: 'Valor desconto', kind: 'currency' },
      { slug: 'valor_impostos', displayName: 'Valor impostos', kind: 'currency' },
      { slug: 'valor_total', displayName: 'Valor total', kind: 'currency' },
      // Gancho da Fase 5 (contas a pagar). TEXTO: não existe entidade de condições de
      // pagamento neste banco (só `bling_formas_pagamento`, que morre com o Bling).
      { slug: 'condicao_pagamento', displayName: 'Condicao de pagamento', kind: 'text' },
      { slug: 'chave_nfe', displayName: 'Chave NFe', kind: 'text' },
      { slug: 'status', displayName: 'Status', kind: 'select', options: ['rascunho', 'lancada', 'cancelada'] },
    ],
  },
  {
    slug: 'itens_nota_entrada',
    displayName: 'Itens Nota Entrada',
    fields: [
      { slug: 'nota', displayName: 'Nota', kind: 'relation', targetSlug: 'notas_de_entrada' },
      { slug: 'insumo', displayName: 'Insumo', kind: 'relation', targetSlug: 'produtos' },
      // Em unidade de COMPRA.
      { slug: 'qtd', displayName: 'Qtd', kind: 'decimal', decimalPlaces: 4 },
      { slug: 'preco_unitario', displayName: 'Preco unitario', kind: 'currency', decimalPlaces: 4 },
      { slug: 'desconto', displayName: 'Desconto', kind: 'currency' },
      { slug: 'imposto', displayName: 'Imposto', kind: 'currency' },
      // GRAVADOS PELO MOTOR (domain/CustoNota.ts), nunca digitados.
      { slug: 'frete_rateado', displayName: 'Frete rateado', kind: 'currency' },
      // Em unidade de CONSUMO. É este valor que vira o custo da entrada no estoque.
      { slug: 'custo_unitario_final', displayName: 'Custo unitario final', kind: 'currency', decimalPlaces: 4 },
    ],
  },
  {
    // LINHA ÚNICA. Sem linha cadastrada, o motor usa POLITICA_PADRAO
    // (tudo ligado, rateio por valor) — ver domain/CustoNota.ts.
    slug: 'politica_de_custo_compra',
    displayName: 'Política de Custo Compra',
    fields: [
      { slug: 'incluir_frete', displayName: 'Incluir frete', kind: 'boolean' },
      // Simples Nacional: ICMS/IPI da compra NÃO geram crédito, então viram custo.
      // Por isso o padrão é ligado. É config porque o regime pode mudar.
      { slug: 'incluir_impostos', displayName: 'Incluir impostos', kind: 'boolean' },
      { slug: 'incluir_descontos', displayName: 'Incluir descontos', kind: 'boolean' },
      { slug: 'criterio_rateio_frete', displayName: 'Criterio de rateio do frete', kind: 'select',
        options: ['valor', 'quantidade'] },
    ],
  },
]
