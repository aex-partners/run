export const PrecificacaoError = {
  entidadeFaltando: 'entidade de precificação não provisionada: rode provision-precificacao.ts',
  skuNaoEncontrado: 'SKU não encontrado',
  canalNaoEncontrado: 'canal de venda não encontrado',
  semCanaisAtivos: 'nenhum canal de venda ativo: cadastre ao menos um (definir_canal)',
  semCondicoes: 'nenhuma condição de pagamento cadastrada',

  // Simples Nacional sem imposto configurado é quase certamente config faltando.
  semImposto: 'nenhum parâmetro de imposto: o preço sairá sem imposto. Rode definir_parametros_preco.',

  // percent fora da faixa [0,1] quase sempre é "10" no lugar de "0,10".
  percentForaDaFaixa: (campo: string, v: number): string =>
    `${campo} = ${v} fora da faixa. Percentual é FRAÇÃO: 10% é 0,10, não 10.`,

  informeAlvo: 'informe modeloId ou skuIds',
  listaVazia: 'skuIds vazio: informe ao menos um SKU',
} as const
