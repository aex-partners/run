export const ComprasError = {
  entidadeFaltando: 'entidade de compras não provisionada: rode provision-compras.ts',
  pedidoNaoEncontrado: 'pedido de compra não encontrado',
  notaSemItens: 'nota de entrada sem itens',
  pedidoSemItens: 'pedido de compra sem itens',
  insumoNaoEncontrado: (id: string): string => `insumo ${id} não encontrado`,

  // IDEMPOTÊNCIA. Sem esta guarda, lançar a mesma nota duas vezes (duplo clique, retry do
  // MCP, timeout do HTTP, ou um retry cego depois de um erro de movimento parcial) grava a
  // nota de novo, empurra os movimentos de novo, e PONDERA O CUSTO MÉDIO DUAS VEZES.
  // Permanente, silencioso, e com cara de certo — e o replay reconstrói fielmente o custo
  // dobrado, porque o livro dobrado é o que está lá.
  notaDuplicada: (numero: string, notaId: string): string =>
    `nota ${numero} deste fornecedor já foi lançada (id ${notaId}). Lançá-la de novo ponderaria o custo médio dos insumos DUAS vezes. ` +
    'Se a nota anterior ficou em rascunho com movimentos parciais, corrija-a; não lance uma nova.',

  // `store.get` devolve QUALQUER registro por id, então não serve para checar o TIPO. Confere
  // a pertinência à entidade `depositos`. Sem isto, um id errado só é recusado lá no estoque,
  // com a nota JÁ gravada e presa em rascunho, e o usuário recebe uma mensagem de "movimento
  // parcial" que descreve um problema de infraestrutura quando o que houve foi um erro de digitação.
  depositoNaoEncontrado: (id: string): string => `depósito ${id} não encontrado`,

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

  // `custearNota` devolve UM `ItemCusteado` por item de entrada, NA MESMA ORDEM, sempre que
  // `erros` vem vazio (o serviço já falhou duro antes se não vier). Se este número não bater
  // aqui é um bug em outro lugar, e não dá pra adivinhar qual linha da nota corresponde a
  // qual item custeado — recusar é mais seguro que gravar um preço na linha errada.
  custeioDessincronizado: 'erro interno: o custeio devolveu um número de itens diferente do da nota',

  // Um insumo da nota que não bate com NENHUMA linha do pedido, ou que veio em quantidade
  // maior do que a linha ainda tinha a receber. A nota AINDA é lançada (o material chegou de
  // verdade), mas o vínculo com o pedido pode estar errado, e isso precisa ficar visível.
  sobraNoPedido: (insumoId: string, qtd: number): string =>
    `o item ${insumoId} veio na nota com ${qtd} a mais do que o pedido previa (ou não estava no pedido). Confira se a nota foi amarrada ao pedido certo.`,

  // Os movimentos JÁ ENTRARAM no estoque quando isto acontece: a operação SUCEDEU, mesmo que
  // a nota não tenha sido finalizada. Falhar aqui faria o chamador repetir e lançar a nota de
  // novo (barrado pela guarda de duplicidade, mas ainda assim: o certo é dizer a verdade).
  notaNaoFinalizada: (notaId: string, erro: string): string =>
    `os movimentos de estoque ENTRARAM, mas a nota ${notaId} não foi finalizada (${erro}). Ela está em RASCUNHO. ` +
    `NÃO a lance de novo: o estoque já foi movimentado. Corrija o status da nota ${notaId}.`,
} as const
