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
// Todo erro aqui é DURO: o serviço recusa a nota. Não só entrada inválida (fator
// zerado, quantidade negativa) quebra essas contas: overflow e underflow de ponto
// flutuante fazem o mesmo estrago a partir de operandos perfeitamente finitos, então
// cada valor CALCULADO é conferido depois de calculado, não só os operandos de entrada.

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
  //
  // Mas só importa quando o frete de fato ENTRA na conta: com `incluirFrete: false` ele
  // nunca participa da aritmética (todo item usa `freteRateado: 0`), então cada item já
  // sai PROVADAMENTE finito por esse lado. Barrar a nota inteira por um `valorFrete`
  // inválido que a própria política manda ignorar recusaria itens bons sem motivo.
  const freteInvalido = politica.incluirFrete && !Number.isFinite(valorFrete)
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
  //
  // Mas campo de ENTRADA finito não garante RESULTADO finito: multiplicação e soma
  // estouram, e underflow zera um denominador em silêncio. Por isso a Fase 2 não para
  // na validação dos operandos — ela confere cada valor CALCULADO (o peso do rateio,
  // `qtdConsumo`, `custoTotal`, `custoUnitarioFinal`) DEPOIS de calculado. É essa
  // checagem sobre o resultado, e não uma lista de entradas proibidas, que garante que
  // nenhum custo não-finito escapa: uma implicação sobre a saída, não uma enumeração
  // dos venenos que alguém pensou em testar.
  let custeaveis = validos
  let fretes = politica.incluirFrete
    ? ratearFrete(custeaveis, valorFrete, politica.criterioRateioFrete)
    : custeaveis.map(() => 0)

  // POSTCONDIÇÃO sobre o RESULTADO do rateio, não sobre os operandos: dois itens com
  // todo campo finito podem ter um PESO (qtdCompra × precoUnitario, ou só qtdCompra,
  // conforme o critério) que estoura pra Infinity. Isso estoura o `total` somado dentro
  // de `ratearFrete`, e a fatia do item que estourou volta `Infinity / Infinity = NaN`.
  // `ratearFrete` só devolve `number[]` e não tem como reportar isso (a assinatura dela
  // não muda), então a checagem é feita aqui, sobre o array que ela devolveu: tira o
  // item cuja fatia saiu não-finita — é sempre o próprio item que estourou, nunca o
  // vizinho, porque só ele tem `Infinity` no numerador E no denominador — e RE-RATEIA
  // só sobre quem sobrou. Sem o re-rateio, o item BOM ficaria com a fatia errada
  // (`valorFrete × peso_bom / Infinity = 0`): o frete dele evaporaria em silêncio, sem
  // nenhum erro, mesmo ele sendo provadamente são.
  if (politica.incluirFrete) {
    let poluidos = custeaveis.filter((_, i) => !Number.isFinite(fretes[i]))
    while (poluidos.length > 0) {
      for (const item of poluidos) {
        erros.push(
          `insumo ${item.insumoId}: peso do item no rateio de frete não é finito, item não pôde ser custeado`,
        )
      }
      custeaveis = custeaveis.filter((_, i) => Number.isFinite(fretes[i]))
      fretes = custeaveis.length > 0
        ? ratearFrete(custeaveis, valorFrete, politica.criterioRateioFrete)
        : []
      poluidos = custeaveis.filter((_, i) => !Number.isFinite(fretes[i]))
    }
  }

  const out: ItemCusteado[] = []

  for (const [i, item] of custeaveis.entries()) {
    // `ratearFrete` devolve SEMPRE um valor por item (todos os seus caminhos são
    // `itens.map`), e o ramo do `else` também. O `?? 0` aqui só existe para o
    // noUncheckedIndexedAccess do TypeScript, que não consegue provar isso: o filtro
    // logo acima já garante que `fretes[i]` é finito para todo item que este laço
    // visita, então este `?? 0` nunca dispara de fato em execução.
    const freteRateado = fretes[i] ?? 0

    const qtdConsumo = item.qtdCompra * item.fatorConversao

    // Guarda no valor CALCULADO, não só nos operandos: `qtdCompra` e `fatorConversao`
    // já passaram pela Fase 1 (finitos e positivos), mas o PRODUTO dos dois pode fazer
    // underflow pra 0 (ex.: 1e-200 × 1e-200) ou overflow pra Infinity (ex.: 1e308 × 10).
    // O primeiro é divisão por zero logo abaixo; o segundo evapora o custo unitário pra
    // 0. Os dois em silêncio, e os dois com `erros` vazio se só os operandos fossem
    // checados. Mesma mensagem da Fase 1: para quem lê o erro, é a mesma causa raiz.
    if (!(qtdConsumo > 0) || !Number.isFinite(qtdConsumo)) {
      erros.push(
        `insumo ${item.insumoId}: quantidade em unidade de consumo deve ser maior que zero (recebido: ${qtdConsumo})`,
      )
      continue
    }

    const custoTotal =
      item.qtdCompra * item.precoUnitario
      - (politica.incluirDescontos ? item.desconto : 0)
      + freteRateado
      + (politica.incluirImpostos ? item.imposto : 0)

    // A SOMA pode estourar mesmo com todo operando finito (ex.: `precoUnitario` e
    // `imposto` ambos perto de `Number.MAX_VALUE`). Sem esta guarda, `custoTotal:
    // Infinity` sairia com `erros` vazio, e o custo médio do insumo viraria lixo.
    if (!Number.isFinite(custoTotal)) {
      erros.push(`insumo ${item.insumoId}: custo total não-finito (recebido: ${custoTotal})`)
      continue
    }

    const custoUnitarioFinal = custoTotal / qtdConsumo

    // Divisão de dois finitos ainda pode sair não-finita perto dos limites de
    // precisão do double (custoTotal enorme / qtdConsumo minúscula). Confere o
    // RESULTADO da divisão, não só os dois lados dela.
    if (!Number.isFinite(custoUnitarioFinal)) {
      erros.push(`insumo ${item.insumoId}: custo unitário final não-finito (recebido: ${custoUnitarioFinal})`)
      continue
    }

    out.push({
      insumoId: item.insumoId,
      qtdCompra: item.qtdCompra,
      qtdConsumo,
      freteRateado,
      custoTotal,
      custoUnitarioFinal,
    })
  }

  return { itens: out, erros }
}
