export const ComprasError = {
  entidadeFaltando: 'entidade de compras não provisionada: rode provision-compras.ts',
  pedidoNaoEncontrado: 'pedido de compra não encontrado',
  notaSemItens: 'nota de entrada sem itens',
  pedidoSemItens: 'pedido de compra sem itens',
  insumoNaoEncontrado: (id: string): string => `insumo ${id} não encontrado`,

  // A nota move estoque. Um insumo sem `controla_estoque` seria recusado pelo estoque
  // DEPOIS da nota já estar gravada. Barra ANTES, e a nota nem começa.
  insumoSemControleDeEstoque: (id: string): string =>
    `insumo ${id} não controla estoque: ligue controla_estoque no cadastro do produto antes de lançar a nota`,

  custeioInvalido: (erros: string[]): string =>
    `nota não lançada, o custo não pôde ser calculado: ${erros.join('; ')}`,

  // Uma entrada a custo zero zeraria o custo médio do insumo, em silêncio, e o aviso de custo
  // defasado nem dispararia (o valor não "muda"). Material recebido de graça NÃO é uma compra a
  // custo zero: entra por um `ajuste` de estoque, que soma a quantidade ao custo médio vigente
  // e não mente sobre o custo.
  itemSemCusto: (insumoIds: string[]): string =>
    `nota não lançada: ${insumoIds.length === 1 ? 'o item' : 'os itens'} ${insumoIds.join(', ')} ${insumoIds.length === 1 ? 'ficou' : 'ficaram'} com custo unitário ZERO. ` +
    'Uma entrada a custo zero corromperia o custo médio do insumo, em silêncio. ' +
    'Confira o preço, o desconto e o fator de conversão. Se o material veio de graça (bonificação), ' +
    'registre um ajuste de estoque em vez de incluí-lo na nota.',

  // Não há transação entre a gravação da nota e os movimentos de estoque. Se um
  // movimento falhar no meio, a nota fica em `rascunho` com movimentos PARCIAIS.
  // Falha ALTO e diz exatamente o que fazer, em vez de deixar o estoque torto calado.
  movimentoParcial: (notaId: string, erro: string): string =>
    `nota ${notaId} ficou em RASCUNHO com movimentos de estoque parciais: ${erro}. ` +
    'Rode scripts/replay-estoque.ts para reconstruir as projeções e confira os movimentos ' +
    `com origem_id=${notaId} antes de relançar.`,
} as const
