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

// Finito e estritamente positivo. Usado para quantidades: `qtdCompra` e
// `fatorConversao` não fazem sentido zerados, negativos, NaN ou infinitos, e
// `Infinity > 0` é `true` — só `Number.isFinite` pega o Infinity que a guarda
// negada (`!(v > 0)`) deixa passar.
const positivoFinito = (v: number): boolean => Number.isFinite(v) && v > 0

export function custearNota(input: {
  itens: ItemNotaInput[]
  valorFrete: number
  politica: PoliticaCusto
}): CustoNotaResult {
  const { itens, valorFrete, politica } = input

  const erros: string[] = []

  // Dinheiro não-finito (NaN/Infinity) atravessaria todas as contas em silêncio e
  // produziria um custo NaN com `erros` VAZIO: a nota seria ACEITA e o custo médio do
  // insumo viraria lixo. `??` não pega NaN, e `NaN === 0` é falso, então nenhuma das
  // guardas existentes barra isso. Erro DURO: a nota não lança.
  const freteInvalido = !Number.isFinite(valorFrete)
  if (freteInvalido) {
    erros.push(`valor do frete inválido (${valorFrete})`)
  }

  // FASE 1 — valida CADA item, sobre a lista INTEIRA, ANTES de qualquer conta. Um
  // item ruim aqui só entra em `erros`: ele nunca chega a `ratearFrete` nem ao custeio.
  // É isso que impede um `precoUnitario: NaN` de envenenar o `total` do rateio e
  // devolver `freteRateado: NaN` para os itens BONS vizinhos (o item ruim não polui
  // mais o rateio porque ele nem participa da lista que a Fase 2 rateia).
  const validos: ItemNotaInput[] = []

  for (const item of itens) {
    let itemInvalido = false
    for (const [campo, v] of [
      ['precoUnitario', item.precoUnitario],
      ['desconto', item.desconto],
      ['imposto', item.imposto],
    ] as const) {
      if (!Number.isFinite(v)) {
        erros.push(`insumo ${item.insumoId}: ${campo} inválido (${v})`)
        itemInvalido = true
      }
    }
    if (itemInvalido) continue

    if (!positivoFinito(item.fatorConversao)) {
      erros.push(
        `insumo ${item.insumoId}: fator_conversao deve ser maior que zero (recebido: ${item.fatorConversao}). ` +
        'Corrija o cadastro do produto: é ele que converte a unidade de compra na unidade de consumo.',
      )
      continue
    }

    if (!positivoFinito(item.qtdCompra)) {
      erros.push(
        `insumo ${item.insumoId}: quantidade em unidade de consumo deve ser maior que zero (recebido: ${item.qtdCompra * item.fatorConversao})`,
      )
      continue
    }

    validos.push(item)
  }

  // O frete é UM valor por NOTA INTEIRA, não por item: se ele não for finito, todo
  // rateio que dependa dele sai não-finito para QUALQUER item, sem exceção. Ao
  // contrário de um item ruim (que só contamina a si mesmo e é isolado pela Fase 1),
  // não existe subconjunto "bom" a salvar aqui. Por isso a nota inteira para de ser
  // custeada: nenhum item sai com `freteRateado`, `custoTotal` ou `custoUnitarioFinal`
  // poluído. O erro de `valorFrete` já foi empurrado para `erros` lá em cima.
  if (freteInvalido) {
    return { itens: [], erros }
  }

  // FASE 2 — rateia o frete só sobre os itens VÁLIDOS, e custeia cada um. Todo campo
  // que entra nas contas abaixo (`qtdCompra`, `fatorConversao`, `precoUnitario`,
  // `desconto`, `imposto`, e o `valorFrete` que alimenta `ratearFrete`) já passou pela
  // Fase 1 ou pelo guard acima: nenhum deles pode ser NaN ou Infinity aqui.
  const fretes = politica.incluirFrete
    ? ratearFrete(validos, valorFrete, politica.criterioRateioFrete)
    : validos.map(() => 0)

  const out: ItemCusteado[] = []

  for (const [i, item] of validos.entries()) {
    const qtdConsumo = item.qtdCompra * item.fatorConversao

    // `ratearFrete` devolve SEMPRE um valor por item (todos os seus caminhos são
    // `itens.map`), e o ramo do `else` também. Logo `fretes[i]` existe para todo `i`
    // que este laço visita: o `?? 0` só existe para o noUncheckedIndexedAccess do
    // TypeScript, que não consegue provar isso, e nunca dispara em execução por
    // índice ausente.
    //
    // Isso NÃO cobre `NaN`: `??` só pega `null`/`undefined`, e `NaN ?? 0` é `NaN`. Mas
    // agora isso é inofensivo de verdade, não só por sorte: o guard logo acima já
    // interrompeu a função (com `itens: []`) se `valorFrete` não fosse finito, e todo
    // `item` que chega aqui veio de `validos`, ou seja, já passou pela Fase 1 com
    // `precoUnitario`, `desconto`, `imposto` finitos e `fatorConversao`/`qtdCompra`
    // finitos e positivos. Logo `fretes[i]` é sempre um número finito real — nunca
    // `NaN`, nunca `Infinity` — e a garantia do módulo é uma implicação, não uma
    // esperança: todo item que sai custeado TEM custo finito, ponto. Um custo
    // não-finito só poderia escapar se algum destes inputs escapasse da Fase 1 sem
    // validação, o que não acontece.
    const freteRateado = fretes[i] ?? 0

    const custoTotal =
      item.qtdCompra * item.precoUnitario
      - (politica.incluirDescontos ? item.desconto : 0)
      + freteRateado
      + (politica.incluirImpostos ? item.imposto : 0)

    out.push({
      insumoId: item.insumoId,
      qtdCompra: item.qtdCompra,
      qtdConsumo,
      freteRateado,
      custoTotal,
      custoUnitarioFinal: custoTotal / qtdConsumo,
    })
  }

  return { itens: out, erros }
}
