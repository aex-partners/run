// ACL out-port -> contexto `estoque`. O ÚNICO ponto de contato entre os dois.
//
// `compras` decide QUANTO custa; `estoque` decide QUANTO TEM e qual é o médio. A nota
// de entrada, ao ser lançada, empurra uma entrada por item para cá — já CONVERTIDA para
// a unidade de CONSUMO (o `compras` faz a conversão; o estoque só vive em consumo).
export interface MovimentoEntrada {
  insumoId: string
  depositoId: string
  // Em unidade de CONSUMO, sempre positiva (é entrada).
  qtd: number
  // Em unidade de CONSUMO. É ele que forma o custo médio ponderado.
  custoUnitario: number
  origemTipo: string
  origemId: string
  data?: string
  observacao?: string
}

export interface EstoqueMovimentos {
  registrarEntrada(m: MovimentoEntrada): Promise<{
    movimentoId: string
    saldoTotal: number
    custoMedio: number
    // Erros SUAVES do lado do estoque (ex.: a projeção de `produtos.custo_medio` /
    // `preco_custo` falhou depois que o livro já foi gravado). O movimento FOI aceito — não é
    // motivo para o `compras` recusar a nota — mas precisa ficar visível, porque
    // `preco_custo` é o campo que o `costing` lê como custo do material.
    erros: string[]
  }>
}
