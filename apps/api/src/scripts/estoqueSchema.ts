// Livro razão do estoque: movimentos append-only + as projeções (saldo por depósito,
// custo médio global por insumo). Todo displayName slugifica exatamente no slug
// declarado (travado pelo teste): os scripts de provisionamento pulam por slug.
import { EntitySpec, FieldSpec } from '@/scripts/schemaSpec'

// Os tipos de movimento da Fase 1. As Fases 2 e 3 acrescentam `consumo_producao` e
// `saida_venda` a esta lista, sem migração.
// APENAS `entrada_nota` e `inventario_abertura` mudam o custo médio (ver domain/CustoMedio.ts).
export const TIPOS_MOVIMENTO = [
  'entrada_nota', 'inventario_abertura', 'ajuste', 'contagem',
  'devolucao_fornecedor', 'saida_manual',
] as const

export const ESTOQUE_ENTITIES: EntitySpec[] = [
  {
    slug: 'depositos',
    displayName: 'Depósitos',
    fields: [
      { slug: 'nome', displayName: 'Nome', kind: 'text' },
      { slug: 'ativo', displayName: 'Ativo', kind: 'boolean' },
    ],
  },
  {
    // O LIVRO. Append-only: é a VERDADE do estoque. `produtos.custo_medio`,
    // `produtos.saldo_total` e `saldos_de_estoque` são projeções DELE, reconstruíveis
    // por scripts/replay-estoque.ts. Cada linha grava o saldo e o custo médio
    // RESULTANTES, então "por que o custo da sarja é R$ X hoje?" se responde lendo
    // o livro em ordem, sem recalcular nada.
    slug: 'movimentos_de_estoque',
    displayName: 'Movimentos de Estoque',
    fields: [
      { slug: 'insumo', displayName: 'Insumo', kind: 'relation', targetSlug: 'produtos' },
      { slug: 'deposito', displayName: 'Deposito', kind: 'relation', targetSlug: 'depositos' },
      { slug: 'tipo', displayName: 'Tipo', kind: 'select', options: [...TIPOS_MOVIMENTO] },
      // COM SINAL: positivo entra, negativo sai. Sempre em unidade de CONSUMO.
      { slug: 'qtd', displayName: 'Qtd', kind: 'decimal', decimalPlaces: 4 },
      // Custo unitário DESTE movimento, em unidade de CONSUMO. Numa entrada é o custo
      // custeado pela nota; nos demais tipos é o custo médio vigente (o custo pelo qual
      // a quantidade saiu/entrou).
      { slug: 'custo_unitario', displayName: 'Custo unitario', kind: 'currency', decimalPlaces: 4 },
      { slug: 'data', displayName: 'Data', kind: 'datetime' },
      // O documento que causou o movimento (ex.: 'nota_entrada' + id da nota).
      { slug: 'origem_tipo', displayName: 'Origem tipo', kind: 'text' },
      { slug: 'origem_id', displayName: 'Origem id', kind: 'text' },
      { slug: 'saldo_deposito_apos', displayName: 'Saldo deposito apos', kind: 'decimal', decimalPlaces: 4 },
      { slug: 'saldo_total_apos', displayName: 'Saldo total apos', kind: 'decimal', decimalPlaces: 4 },
      { slug: 'custo_medio_apos', displayName: 'Custo medio apos', kind: 'currency', decimalPlaces: 4 },
      { slug: 'observacao', displayName: 'Observacao', kind: 'long_text' },
    ],
  },
  {
    // PROJEÇÃO do saldo por (insumo, depósito). Materializada porque varrer o livro a
    // cada leitura estoura o teto de 500 linhas da query do contexto `data`.
    slug: 'saldos_de_estoque',
    displayName: 'Saldos de Estoque',
    fields: [
      { slug: 'insumo', displayName: 'Insumo', kind: 'relation', targetSlug: 'produtos' },
      { slug: 'deposito', displayName: 'Deposito', kind: 'relation', targetSlug: 'depositos' },
      { slug: 'qtd', displayName: 'Qtd', kind: 'decimal', decimalPlaces: 4 },
    ],
  },
]

// Campos que o `estoque` acrescenta a Produtos.
//
// `preco_custo` (que já existe, semântica Bling) continua sendo o campo que o `costing`
// lê como custo de MATERIAL na explosão. O estoque é dono de `custo_medio` e ESPELHA o
// valor em `preco_custo` — assim o costing não muda uma linha.
//
// `custo_medio_atualizado_em` só é reescrito quando o custo médio MUDA de valor. É o
// carimbo que `CustosDesatualizados` compara contra a data do snapshot de custo do SKU.
// Se fosse escrito a cada movimento, toda saída marcaria tudo como defasado.
export const PRODUTOS_ESTOQUE_FIELDS: FieldSpec[] = [
  { slug: 'unidade_compra', displayName: 'Unidade de compra', kind: 'text' },
  // A unidade em que a FICHA TÉCNICA consome. O estoque e o custo médio vivem SEMPRE nela.
  { slug: 'unidade_consumo', displayName: 'Unidade de consumo', kind: 'text' },
  // Quantas unidades de CONSUMO cabem em 1 unidade de COMPRA (1 rolo = 50 m -> 50).
  { slug: 'fator_conversao', displayName: 'Fator de conversao', kind: 'decimal', decimalPlaces: 6 },
  // Só quem tem isto ligado ganha movimento. Evita criar saldo para os ~9.936 produtos.
  { slug: 'controla_estoque', displayName: 'Controla estoque', kind: 'boolean' },
  { slug: 'custo_medio', displayName: 'Custo medio', kind: 'currency', decimalPlaces: 4 },
  { slug: 'saldo_total', displayName: 'Saldo total', kind: 'decimal', decimalPlaces: 4 },
  { slug: 'custo_medio_atualizado_em', displayName: 'Custo medio atualizado em', kind: 'datetime' },
  // O ESPELHO. É o campo que o `costing` lê como custo de MATERIAL na explosão da ficha, e é
  // por ele que o custo médio do estoque chega ao custo do produto sem o costing mudar uma linha.
  //
  // NINGUÉM o declarava: `costingSchema` e este arquivo apenas COMENTAVAM que ele "já existe"
  // (semântica Bling), e o espelho do Bling cria `preco_de_custo`, com "de" — outro campo. Ele
  // existe em produção só porque nasceu do uso real. Num ambiente novo não existiria, e aí o
  // RecordSchema rejeitaria a chave desconhecida e a atualização INTEIRA do produto falharia:
  // custo_medio e saldo_total nunca seriam persistidos, e a ficha fecharia com material a R$ 0.
  { slug: 'preco_custo', displayName: 'Preco custo', kind: 'currency', decimalPlaces: 4 },
]
