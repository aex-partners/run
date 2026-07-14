export const EstoqueError = {
  entidadeFaltando: 'entidade de estoque não provisionada: rode provision-estoque.ts',
  insumoNaoEncontrado: 'insumo não encontrado',
  depositoNaoEncontrado: 'depósito não encontrado',
  tipoInvalido: (tipo: string, validos: readonly string[]): string =>
    `tipo de movimento inválido: "${tipo}". Válidos: ${validos.join(', ')}`,

  // `controla_estoque` é o interruptor que evita criar saldo para os ~9.936 produtos.
  // Movimentar um produto sem ele ligado criaria um livro fantasma que ninguém lê.
  semControleDeEstoque: (insumoId: string): string =>
    `produto ${insumoId} não controla estoque: ligue controla_estoque no cadastro antes de movimentá-lo`,

  // Entrada sem custo produziria um custo médio ZERADO em silêncio — o pior modo de
  // falha possível num motor de custo.
  entradaSemCusto: (tipo: string): string =>
    `movimento do tipo "${tipo}" exige custoUnitario (é ele que forma o custo médio)`,

  // custoUnitario ZERO zeraria o custo médio do insumo, e o pior: `mudouCusto` seria falso
  // (0 -> 0), então `custo_medio_atualizado_em` nem seria carimbado e o aviso de custo
  // defasado NÃO dispararia. Um custo zerado que nenhum alarme pega. Negativo é pior ainda.
  // Material recebido de graça (bonificação) NÃO é uma entrada a custo zero: entra por
  // `ajuste`, que soma a quantidade ao custo médio vigente e não mente sobre o custo.
  entradaCustoInvalido: (tipo: string, custo: number): string =>
    `movimento do tipo "${tipo}" exige custoUnitario maior que zero (recebido: ${custo}). ` +
    'Um custo zero ou negativo corromperia o custo médio do insumo, em silêncio. ' +
    'Se o material veio de graça, registre um "ajuste" (entra ao custo médio vigente) em vez de uma entrada a custo zero.',

  entradaQtdInvalida: (tipo: string, qtd: number): string =>
    `movimento do tipo "${tipo}" exige quantidade positiva (recebido: ${qtd})`,

  qtdZero: 'quantidade do movimento não pode ser zero',

  // SOFT: o movimento é gravado, o saldo fica negativo, e isto sai em `erros`.
  saldoNegativo: (insumoId: string, saldo: number): string =>
    `saldo do insumo ${insumoId} ficou NEGATIVO (${saldo}): há saída sem entrada correspondente. ` +
    'Lance a nota que falta, ou acerte por contagem.',

  // SOFT: o movimento JÁ FOI GRAVADO no livro, que é a verdade. Só as projeções ficaram para
  // trás. Devolver falha aqui convidaria o chamador a repetir a operação, e um retry gravaria
  // um SEGUNDO movimento para a mesma nota, ponderando o custo médio DUAS vezes — permanente,
  // e com cara de certo. O replay reconstrói as projeções a partir do livro.
  projecaoDesatualizada: (erro: string): string =>
    `movimento gravado no livro, mas as projeções (saldo / custo médio) não foram atualizadas: ${erro}. ` +
    'NÃO repita a operação: o movimento já está lançado. Rode scripts/replay-estoque.ts para reconstruir as projeções a partir do livro.',
} as const
