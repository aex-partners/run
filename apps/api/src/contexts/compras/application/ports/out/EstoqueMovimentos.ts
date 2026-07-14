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
  registrarEntrada(m: MovimentoEntrada): Promise<{ movimentoId: string; saldoTotal: number; custoMedio: number }>
}
