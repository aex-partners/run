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
  entradaQtdInvalida: (tipo: string, qtd: number): string =>
    `movimento do tipo "${tipo}" exige quantidade positiva (recebido: ${qtd})`,

  qtdZero: 'quantidade do movimento não pode ser zero',

  // SOFT: o movimento é gravado, o saldo fica negativo, e isto sai em `erros`.
  saldoNegativo: (insumoId: string, saldo: number): string =>
    `saldo do insumo ${insumoId} ficou NEGATIVO (${saldo}): há saída sem entrada correspondente. ` +
    'Lance a nota que falta, ou acerte por contagem.',
} as const
