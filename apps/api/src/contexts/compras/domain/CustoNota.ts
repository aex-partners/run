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

// Um item que sobrevive à Fase 1 carrega o que já foi calculado dele: `qtdConsumo` e a
// parte do custo que NÃO depende do frete (`base`). Isso evita recalcular — e evita
// que a Fase 3 dependa de novo dos operandos crus depois que o item já passou.
interface Custeavel {
  item: ItemNotaInput
  qtdConsumo: number
  base: number
}

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

  // FASE 1 — valida CADA item, sobre a lista INTEIRA, e calcula tudo que NÃO depende do
  // frete: a quantidade de consumo e a parte do custo que já é conhecida sem ratear nada
  // (`base`). Um item ruim aqui só entra em `erros`: ele nunca chega a `ratearFrete` nem
  // ao custeio final. É isso que impede um `precoUnitario: NaN` — ou um item cujo próprio
  // peso já estoura sozinho — de envenenar o `total` do rateio e devolver `freteRateado`
  // errado para os itens BONS vizinhos: o item ruim não participa da lista que a Fase 2
  // rateia, porque ele nem chega a virar um `Custeavel`.
  const custeaveis: Custeavel[] = []

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

    const qtdConsumo = item.qtdCompra * item.fatorConversao

    // Guarda no valor CALCULADO, não só nos operandos: `qtdCompra` e `fatorConversao`
    // já passaram pelas checagens acima (finitos e positivos), mas o PRODUTO dos dois
    // pode fazer underflow pra 0 (ex.: 1e-200 × 1e-200) ou overflow pra Infinity (ex.:
    // 1e308 × 10). O primeiro é divisão por zero mais adiante; o segundo evapora o custo
    // unitário. Os dois em silêncio, e os dois com `erros` vazio se só os operandos
    // fossem checados. Mesma mensagem: para quem lê o erro, é a mesma causa raiz.
    if (!(qtdConsumo > 0) || !Number.isFinite(qtdConsumo)) {
      erros.push(
        `insumo ${item.insumoId}: quantidade em unidade de consumo deve ser maior que zero (recebido: ${qtdConsumo})`,
      )
      continue
    }

    // `base` é o custo do item SEM o frete: o que já dá pra saber antes de ratear nada.
    // A SOMA pode estourar mesmo com todo operando finito (ex.: `precoUnitario` e
    // `imposto` ambos perto de `Number.MAX_VALUE`), e é aqui, ANTES do rateio, que isso
    // é pego: um item cujo próprio peso já estoura não pode entrar em `ratearFrete` e
    // inflar o `total` somado lá dentro.
    const base =
      item.qtdCompra * item.precoUnitario
      - (politica.incluirDescontos ? item.desconto : 0)
      + (politica.incluirImpostos ? item.imposto : 0)

    if (!Number.isFinite(base)) {
      erros.push(`insumo ${item.insumoId}: custo total não-finito (recebido: ${base})`)
      continue
    }

    custeaveis.push({ item, qtdConsumo, base })
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

  // FASE 2 — rateia o frete UMA ÚNICA VEZ, sobre o conjunto FINAL de sobreviventes da
  // Fase 1. Não existe re-rateio: um item só entra aqui depois de já estar
  // definitivamente custeável, então não há como um rateio feito agora ficar velho.
  const fretes = politica.incluirFrete
    ? ratearFrete(custeaveis.map((c) => c.item), valorFrete, politica.criterioRateioFrete)
    : custeaveis.map(() => 0)

  // A INVARIANTE QUE O PRÓPRIO ratearFrete PROMETE: a soma dos rateados é o valor do
  // frete. Checar as PARCELAS (finitas?) não basta: se a soma dos PESOS estourar para
  // Infinity lá dentro, cada parcela sai `valorFrete × peso / Infinity` = 0 — finita, e
  // o frete INTEIRO some do custo, em silêncio. Verificar o VALOR CALCULADO, e não os
  // seus pedaços, é o que torna isto uma implicação em vez de uma lista de venenos que
  // alguém lembrou de prever.
  if (politica.incluirFrete && custeaveis.length > 0) {
    const somaFretes = fretes.reduce((s, f) => s + f, 0)
    const esperado = valorFrete
    const tolerancia = Math.max(Math.abs(esperado), 1) * 1e-9
    if (!Number.isFinite(somaFretes) || Math.abs(somaFretes - esperado) > tolerancia) {
      erros.push(
        `rateio do frete não fecha: a soma das parcelas (${somaFretes}) difere do frete da nota (${esperado}). ` +
        'Confira as quantidades e os preços dos itens.',
      )
      // Nenhum item é custeado: o rateio é global, então um rateio quebrado contamina TODOS.
      return { itens: [], erros }
    }
  }

  // FASE 3 — custeia cada sobrevivente com o `qtdConsumo` e a `base` já calculados na
  // Fase 1, mais a fatia de frete que a Fase 2 apurou. As guardas abaixo são uma REDE
  // final: depois das Fases 1 e 2, `custoTotal` e `custoUnitarioFinal` já deveriam ser
  // provadamente finitos. Mantê-las mesmo assim não custa nada e é o ponto do método —
  // uma postcondição que se prova inalcançável ainda vale a pena escrever.
  const out: ItemCusteado[] = []

  for (const [i, c] of custeaveis.entries()) {
    // `ratearFrete` e o ramo `else` acima sempre devolvem um valor por item (todos os
    // caminhos são `itens.map`). O `?? 0` aqui só existe para o noUncheckedIndexedAccess
    // do TypeScript, que não consegue provar isso: nunca dispara de fato em execução.
    const freteRateado = fretes[i] ?? 0

    const custoTotal = c.base + freteRateado

    if (!Number.isFinite(custoTotal)) {
      erros.push(`insumo ${c.item.insumoId}: custo total não-finito (recebido: ${custoTotal})`)
      continue
    }

    const custoUnitarioFinal = custoTotal / c.qtdConsumo

    if (!Number.isFinite(custoUnitarioFinal)) {
      erros.push(`insumo ${c.item.insumoId}: custo unitário final não-finito (recebido: ${custoUnitarioFinal})`)
      continue
    }

    out.push({
      insumoId: c.item.insumoId,
      qtdCompra: c.item.qtdCompra,
      qtdConsumo: c.qtdConsumo,
      freteRateado,
      custoTotal,
      custoUnitarioFinal,
    })
  }

  return { itens: out, erros }
}
