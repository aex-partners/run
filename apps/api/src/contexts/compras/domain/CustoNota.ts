// Custo do item da nota de entrada. Domínio PURO: sem I/O.
//
// Duas coisas acontecem aqui, e as duas corrompem o custo em silêncio se saírem erradas:
//
//   1) RATEIO DO FRETE  freteRateado[i] = valorFrete × peso[i] / Σpeso
//   2) CONVERSÃO DE UNIDADE  a nota vem em unidade de COMPRA; o estoque e o custo médio
//      vivem em unidade de CONSUMO (a que a ficha técnica usa).
//
//        qtdConsumo          = qtdCompra × fatorConversao
//        custoUnitarioFinal  = custoTotal / qtdConsumo
//
// TODO erro aqui é DURO: o serviço recusa a nota. Um fator inválido ou uma quantidade
// zerada só poderiam produzir divisão por zero ou um custo inventado.

export interface PoliticaCusto {
  incluirFrete: boolean
  incluirImpostos: boolean
  incluirDescontos: boolean
  criterioRateioFrete: 'valor' | 'quantidade'
}

// Usado quando não há linha em `politica_de_custo_compra`. Impostos entram por padrão
// porque a empresa é Simples Nacional: ICMS/IPI da compra NÃO geram crédito, então
// viram custo. É config porque o regime pode mudar.
export const POLITICA_PADRAO: PoliticaCusto = {
  incluirFrete: true,
  incluirImpostos: true,
  incluirDescontos: true,
  criterioRateioFrete: 'valor',
}

export interface ItemNotaInput {
  insumoId: string
  qtdCompra: number       // unidade de COMPRA (o que o fornecedor faturou)
  precoUnitario: number   // por unidade de COMPRA
  desconto: number        // valor absoluto, no item
  imposto: number         // valor absoluto, no item
  fatorConversao: number  // quantas unidades de CONSUMO cabem em 1 de COMPRA
}

export interface ItemCusteado {
  insumoId: string
  qtdCompra: number
  qtdConsumo: number
  freteRateado: number
  custoTotal: number
  custoUnitarioFinal: number  // em unidade de CONSUMO: é o custo da entrada no estoque
}

export interface CustoNotaResult {
  itens: ItemCusteado[]
  erros: string[]
}

// Rateio proporcional ao valor (padrão contábil) ou à quantidade.
// A soma dos rateados é SEMPRE igual ao valor do frete: nenhum centavo some.
export function ratearFrete(
  itens: ItemNotaInput[],
  valorFrete: number,
  criterio: 'valor' | 'quantidade',
): number[] {
  if (itens.length === 0) return []
  if (valorFrete === 0) return itens.map(() => 0)

  const peso = (i: ItemNotaInput) =>
    criterio === 'quantidade' ? i.qtdCompra : i.qtdCompra * i.precoUnitario
  const total = itens.reduce((s, i) => s + peso(i), 0)

  // Sem base de rateio (todos os pesos zerados): divide igualmente. Zerar o rateio
  // aqui jogaria o frete FORA do custo, em silêncio.
  if (total === 0) {
    const cada = valorFrete / itens.length
    return itens.map(() => cada)
  }

  return itens.map((i) => (valorFrete * peso(i)) / total)
}

export function custearNota(input: {
  itens: ItemNotaInput[]
  valorFrete: number
  politica: PoliticaCusto
}): CustoNotaResult {
  const { itens, valorFrete, politica } = input

  const fretes = politica.incluirFrete
    ? ratearFrete(itens, valorFrete, politica.criterioRateioFrete)
    : itens.map(() => 0)

  const out: ItemCusteado[] = []
  const erros: string[] = []

  for (const [i, item] of itens.entries()) {
    if (!(item.fatorConversao > 0)) {
      erros.push(
        `insumo ${item.insumoId}: fator_conversao deve ser maior que zero (recebido: ${item.fatorConversao}). ` +
        'Corrija o cadastro do produto: é ele que converte a unidade de compra na unidade de consumo.',
      )
      continue
    }
    const qtdConsumo = item.qtdCompra * item.fatorConversao
    if (!(qtdConsumo > 0)) {
      erros.push(
        `insumo ${item.insumoId}: quantidade em unidade de consumo deve ser maior que zero (recebido: ${qtdConsumo})`,
      )
      continue
    }

    const custoTotal =
      item.qtdCompra * item.precoUnitario
      - (politica.incluirDescontos ? item.desconto : 0)
      + fretes[i]
      + (politica.incluirImpostos ? item.imposto : 0)

    out.push({
      insumoId: item.insumoId,
      qtdCompra: item.qtdCompra,
      qtdConsumo,
      freteRateado: fretes[i],
      custoTotal,
      custoUnitarioFinal: custoTotal / qtdConsumo,
    })
  }

  return { itens: out, erros }
}
