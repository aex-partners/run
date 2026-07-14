import { describe, it, expect } from 'vitest'
import {
  ratearFrete, custearNota, POLITICA_PADRAO, ItemNotaInput, PoliticaCusto,
} from '@/contexts/compras/domain/CustoNota'

const item = (over: Partial<ItemNotaInput> = {}): ItemNotaInput => ({
  insumoId: 'i1', qtdCompra: 10, precoUnitario: 10, desconto: 0, imposto: 0, fatorConversao: 1, ...over,
})

describe('ratearFrete', () => {
  it('rateia proporcional ao valor: quem custa mais absorve mais frete', () => {
    const itens = [
      item({ insumoId: 'a', qtdCompra: 1, precoUnitario: 300 }),   // 300 = 75%
      item({ insumoId: 'b', qtdCompra: 1, precoUnitario: 100 }),   // 100 = 25%
    ]
    expect(ratearFrete(itens, 200, 'valor')).toEqual([150, 50])
  })

  it('rateia proporcional à quantidade quando o critério é quantidade', () => {
    const itens = [
      item({ insumoId: 'a', qtdCompra: 3, precoUnitario: 100 }),
      item({ insumoId: 'b', qtdCompra: 1, precoUnitario: 900 }),
    ]
    expect(ratearFrete(itens, 200, 'quantidade')).toEqual([150, 50])
  })

  // A INVARIANTE: nenhum centavo some no rateio.
  it('a soma dos fretes rateados é igual ao valor do frete', () => {
    const itens = [
      item({ insumoId: 'a', qtdCompra: 3, precoUnitario: 17.77 }),
      item({ insumoId: 'b', qtdCompra: 7, precoUnitario: 3.33 }),
      item({ insumoId: 'c', qtdCompra: 1.3, precoUnitario: 250 }),
    ]
    const fretes = ratearFrete(itens, 133.71, 'valor')
    expect(fretes.reduce((s, f) => s + f, 0)).toBeCloseTo(133.71, 10)
  })

  it('frete zero rateia zero', () => {
    expect(ratearFrete([item(), item()], 0, 'valor')).toEqual([0, 0])
  })

  it('nota sem itens não estoura', () => {
    expect(ratearFrete([], 100, 'valor')).toEqual([])
  })

  // Sem base de rateio (tudo zerado), dividir igualmente é o único jeito de o frete
  // NÃO SUMIR do custo. Zerar o rateio jogaria o frete fora em silêncio.
  it('base de rateio zerada divide o frete igualmente', () => {
    const itens = [item({ precoUnitario: 0 }), item({ precoUnitario: 0 })]
    expect(ratearFrete(itens, 100, 'valor')).toEqual([50, 50])
  })
})

describe('custearNota', () => {
  it('soma preço + frete + imposto e abate desconto, na unidade de consumo', () => {
    const r = custearNota({
      itens: [item({ qtdCompra: 10, precoUnitario: 10, desconto: 5, imposto: 8 })],
      valorFrete: 20,
      politica: POLITICA_PADRAO,
    })
    expect(r.erros).toEqual([])
    // 10 × 10 = 100; − 5 desconto; + 20 frete; + 8 imposto = 123. / 10 = 12,30
    expect(r.itens[0].custoTotal).toBeCloseTo(123, 10)
    expect(r.itens[0].qtdConsumo).toBeCloseTo(10, 10)
    expect(r.itens[0].custoUnitarioFinal).toBeCloseTo(12.3, 10)
    expect(r.itens[0].freteRateado).toBeCloseTo(20, 10)
  })

  // O CASO REAL: 15 M2 de sarja compradas, consumidas em metro linear.
  it('converte a unidade de compra para a unidade de consumo', () => {
    const r = custearNota({
      itens: [item({ qtdCompra: 15, precoUnitario: 250, fatorConversao: 2 })],
      valorFrete: 0,
      politica: POLITICA_PADRAO,
    })
    // 15 × 250 = 3750 no total; 15 × 2 = 30 unidades de consumo; 3750 / 30 = 125/un.
    expect(r.itens[0].qtdConsumo).toBeCloseTo(30, 10)
    expect(r.itens[0].custoTotal).toBeCloseTo(3750, 10)
    expect(r.itens[0].custoUnitarioFinal).toBeCloseTo(125, 10)
  })

  it('desligar o frete na política tira o frete do custo', () => {
    const politica: PoliticaCusto = { ...POLITICA_PADRAO, incluirFrete: false }
    const r = custearNota({ itens: [item({ qtdCompra: 10, precoUnitario: 10 })], valorFrete: 50, politica })
    expect(r.itens[0].freteRateado).toBe(0)
    expect(r.itens[0].custoTotal).toBeCloseTo(100, 10)
  })

  it('desligar os impostos na política tira o imposto do custo', () => {
    const politica: PoliticaCusto = { ...POLITICA_PADRAO, incluirImpostos: false }
    const r = custearNota({ itens: [item({ qtdCompra: 10, precoUnitario: 10, imposto: 33 })], valorFrete: 0, politica })
    expect(r.itens[0].custoTotal).toBeCloseTo(100, 10)
  })

  it('desligar os descontos na política ignora o desconto', () => {
    const politica: PoliticaCusto = { ...POLITICA_PADRAO, incluirDescontos: false }
    const r = custearNota({ itens: [item({ qtdCompra: 10, precoUnitario: 10, desconto: 40 })], valorFrete: 0, politica })
    expect(r.itens[0].custoTotal).toBeCloseTo(100, 10)
  })

  it('o padrão liga frete, impostos e descontos, e rateia por valor', () => {
    expect(POLITICA_PADRAO).toEqual({
      incluirFrete: true, incluirImpostos: true, incluirDescontos: true, criterioRateioFrete: 'valor',
    })
  })

  // DIVISÃO POR ZERO: veneno silencioso num motor de custo. A nota NÃO lança.
  it('fator de conversão zerado é erro DURO, e o item não é custeado', () => {
    const r = custearNota({
      itens: [item({ insumoId: 'tecido', fatorConversao: 0 })],
      valorFrete: 0, politica: POLITICA_PADRAO,
    })
    expect(r.itens).toEqual([])
    expect(r.erros).toHaveLength(1)
    expect(r.erros[0]).toContain('tecido')
    expect(r.erros[0]).toContain('fator_conversao')
  })

  it('fator de conversão negativo é erro DURO', () => {
    const r = custearNota({
      itens: [item({ insumoId: 'x', fatorConversao: -1 })],
      valorFrete: 0, politica: POLITICA_PADRAO,
    })
    expect(r.itens).toEqual([])
    expect(r.erros).toHaveLength(1)
  })

  it('quantidade zerada é erro DURO', () => {
    const r = custearNota({
      itens: [item({ insumoId: 'y', qtdCompra: 0 })],
      valorFrete: 0, politica: POLITICA_PADRAO,
    })
    expect(r.itens).toEqual([])
    expect(r.erros).toHaveLength(1)
    expect(r.erros[0]).toContain('y')
  })

  it('um item ruim não invalida os bons: erros e itens custeados voltam juntos', () => {
    const r = custearNota({
      itens: [item({ insumoId: 'bom' }), item({ insumoId: 'ruim', fatorConversao: 0 })],
      valorFrete: 0, politica: POLITICA_PADRAO,
    })
    expect(r.itens.map((i) => i.insumoId)).toEqual(['bom'])
    expect(r.erros).toHaveLength(1)
    // Quem decide recusar a nota inteira é o serviço (Task 7): erros.length > 0 -> fail.
  })

  // NaN/Infinity em dinheiro atravessaria tudo em silêncio: `??` não pega NaN e
  // `NaN === 0` é falso. Sem estas guardas, a nota seria ACEITA com custo NaN.
  it('frete não-finito é erro DURO', () => {
    const r = custearNota({ itens: [item()], valorFrete: NaN, politica: POLITICA_PADRAO })
    expect(r.erros.length).toBeGreaterThan(0)
  })

  it('preço unitário não-finito é erro DURO, e não contamina o custo', () => {
    const r = custearNota({
      itens: [item({ insumoId: 'ruim', precoUnitario: NaN })],
      valorFrete: 0, politica: POLITICA_PADRAO,
    })
    expect(r.itens).toEqual([])
    expect(r.erros.length).toBeGreaterThan(0)
    expect(r.erros[0]).toContain('ruim')
  })

  it('imposto ou desconto não-finito é erro DURO', () => {
    expect(custearNota({ itens: [item({ imposto: Infinity })], valorFrete: 0, politica: POLITICA_PADRAO }).erros.length).toBeGreaterThan(0)
    expect(custearNota({ itens: [item({ desconto: NaN })], valorFrete: 0, politica: POLITICA_PADRAO }).erros.length).toBeGreaterThan(0)
  })

  it('nenhum custo NaN sai daqui com a lista de erros VAZIA', () => {
    const r = custearNota({
      itens: [item({ precoUnitario: NaN }), item({ insumoId: 'b' })],
      valorFrete: NaN, politica: POLITICA_PADRAO,
    })
    // A invariante que fecha o buraco: se algum custo saiu NaN, TEM que haver erro.
    const temNaN = r.itens.some((i) => !Number.isFinite(i.custoUnitarioFinal) || !Number.isFinite(i.custoTotal))
    if (temNaN) expect(r.erros.length).toBeGreaterThan(0)
    expect(r.erros.length).toBeGreaterThan(0)
  })

  // O ELO MAIS PERIGOSO DO MÓDULO, e o que faltava: mais de um item COM frete. Sem este
  // teste, trocar `fretes[i]` por `fretes[0]`, inverter o array, ou chumbar o critério em
  // 'valor' passa na suíte inteira, e o frete vai parar no item errado em silêncio.
  it('cada item recebe O SEU frete rateado, e a soma fecha com o frete da nota', () => {
    const r = custearNota({
      itens: [
        item({ insumoId: 'caro', qtdCompra: 1, precoUnitario: 300 }),   // 75%
        item({ insumoId: 'barato', qtdCompra: 1, precoUnitario: 100 }), // 25%
      ],
      valorFrete: 200,
      politica: POLITICA_PADRAO,
    })
    expect(r.erros).toEqual([])
    expect(r.itens[0].insumoId).toBe('caro')
    expect(r.itens[0].freteRateado).toBeCloseTo(150, 10)
    expect(r.itens[1].insumoId).toBe('barato')
    expect(r.itens[1].freteRateado).toBeCloseTo(50, 10)
    // A invariante: nenhum centavo some no rateio.
    expect(r.itens.reduce((s, i) => s + i.freteRateado, 0)).toBeCloseTo(200, 10)
    // E o custo de cada um carrega O SEU frete: 300 + 150 = 450; 100 + 50 = 150.
    expect(r.itens[0].custoTotal).toBeCloseTo(450, 10)
    expect(r.itens[1].custoTotal).toBeCloseTo(150, 10)
  })

  // O critério da POLÍTICA tem que chegar ao rateio. Chumbar 'valor' passaria em tudo o mais.
  it('custearNota respeita o critério de rateio da política', () => {
    const r = custearNota({
      itens: [
        item({ insumoId: 'a', qtdCompra: 3, precoUnitario: 100 }),
        item({ insumoId: 'b', qtdCompra: 1, precoUnitario: 900 }),
      ],
      valorFrete: 200,
      politica: { ...POLITICA_PADRAO, criterioRateioFrete: 'quantidade' },
    })
    // Por QUANTIDADE: 3/4 e 1/4. Por VALOR seria 300/1200 e 900/1200, o inverso.
    expect(r.itens[0].freteRateado).toBeCloseTo(150, 10)
    expect(r.itens[1].freteRateado).toBeCloseTo(50, 10)
  })

  // A guarda `!(qtdConsumo > 0)` pega NaN mas NÃO pega Infinity (`Infinity > 0` é true).
  // Sem esta guarda: custoTotal = Infinity, custoUnitarioFinal = Infinity/Infinity = NaN,
  // e `erros` VAZIO — a nota seria ACEITA com custo NaN.
  it('quantidade infinita é erro DURO', () => {
    const r = custearNota({
      itens: [item({ insumoId: 'inf', qtdCompra: Infinity })],
      valorFrete: 0, politica: POLITICA_PADRAO,
    })
    expect(r.itens).toEqual([])
    expect(r.erros.length).toBeGreaterThan(0)
    expect(r.erros[0]).toContain('inf')
  })

  it('fator de conversão infinito é erro DURO', () => {
    const r = custearNota({
      itens: [item({ insumoId: 'inf', fatorConversao: Infinity })],
      valorFrete: 0, politica: POLITICA_PADRAO,
    })
    expect(r.itens).toEqual([])
    expect(r.erros.length).toBeGreaterThan(0)
  })

  // HOLE 2: o rateio rodava sobre a lista INTEIRA, então um item ruim envenenava o `total`
  // e o frete do item BOM saía NaN (ou uma fração errada), em silêncio.
  it('um item ruim NÃO contamina o frete do item bom', () => {
    const r = custearNota({
      itens: [
        item({ insumoId: 'ruim', precoUnitario: NaN }),
        item({ insumoId: 'bom', qtdCompra: 2, precoUnitario: 50 }),
      ],
      valorFrete: 100,
      politica: POLITICA_PADRAO,
    })
    expect(r.erros.length).toBeGreaterThan(0)           // a nota será recusada pelo serviço
    expect(r.itens.map((i) => i.insumoId)).toEqual(['bom'])
    // O item bom é o ÚNICO válido, então leva o frete inteiro, e o custo é finito.
    expect(r.itens[0].freteRateado).toBeCloseTo(100, 10)
    expect(Number.isFinite(r.itens[0].custoTotal)).toBe(true)
    expect(Number.isFinite(r.itens[0].custoUnitarioFinal)).toBe(true)
  })

  // A INVARIANTE que fecha o buraco de vez, sobre uma bateria de entradas venenosas:
  // NENHUM custo não-finito sai daqui sem erro, E quando algum item sobrevive com
  // frete, a SOMA das parcelas fecha com o frete da nota. Checar só `Number.isFinite`
  // em cada parcela NÃO pega a soma dos PESOS estourando pra Infinity lá dentro de
  // `ratearFrete` e zerando toda parcela: finita, e errada, em silêncio.
  it('nenhum custo não-finito escapa, e quando sobra item, o frete fecha com a nota', () => {
    const venenos = [
      // literais não-finitos
      { qtdCompra: Infinity }, { qtdCompra: NaN }, { qtdCompra: -Infinity },
      { precoUnitario: Infinity }, { precoUnitario: NaN },
      { desconto: Infinity }, { desconto: NaN },
      { imposto: Infinity }, { imposto: NaN },
      { fatorConversao: Infinity }, { fatorConversao: NaN },
      // OPERANDOS FINITOS cujo RESULTADO não é. É por isto que validar a entrada não basta:
      { qtdCompra: 1e308, precoUnitario: 10 },              // produto -> Infinity
      { precoUnitario: 1.7e308, imposto: 1.7e308 },          // SOMA -> Infinity
      { precoUnitario: -1.7e308, desconto: 1.7e308 },        // soma -> -Infinity
      { qtdCompra: 1e-200, fatorConversao: 1e-200 },         // UNDERFLOW -> qtdConsumo 0 -> divisão por zero
      { qtdCompra: 5e-324, fatorConversao: 0.5 },            // underflow -> 0
      { qtdCompra: 1e308, fatorConversao: 10 },              // overflow -> qtdConsumo Infinity -> custo evapora para 0
      { fatorConversao: 5e-324 },                                   // denormal -> quociente estoura na fase 3
      { qtdCompra: 1e-300, precoUnitario: 1e300, fatorConversao: 1e-23 },
    ]
    for (const criterio of ['valor', 'quantidade'] as const) {
      for (const veneno of venenos) {
        for (const frete of [0, 100, NaN, Infinity]) {
          const r = custearNota({
            itens: [item(veneno), item({ insumoId: 'ok' })],
            valorFrete: frete,
            politica: { ...POLITICA_PADRAO, criterioRateioFrete: criterio },
          })
          const naoFinito = r.itens.some(
            (i) => !Number.isFinite(i.custoTotal) || !Number.isFinite(i.custoUnitarioFinal) || !Number.isFinite(i.freteRateado),
          )
          // Se algum custo saiu não-finito, TEM que haver erro. E, de fato, nada não-finito
          // deveria sair: todo item custeado passou pela validação.
          expect(naoFinito).toBe(false)
          expect(r.erros.length).toBeGreaterThan(0)
          // A PROPRIEDADE que de fato quebrava: se algum item voltou custeado com frete
          // finito na nota, a soma das parcelas TEM que fechar com o frete da nota.
          if (r.itens.length > 0 && Number.isFinite(frete)) {
            const somaFretes = r.itens.reduce((s, i) => s + i.freteRateado, 0)
            expect(somaFretes).toBeCloseTo(frete, 6)
          }
        }
      }
    }

    // FORMAS COM MAIS DE UM ITEM PESADO: nenhum veneno de item único acima consegue
    // estourar a SOMA dos pesos dentro de `ratearFrete` (o item pesado sozinho já é
    // excluído na Fase 1, pela sua própria `base`). Só dois itens grandes JUNTOS
    // estouram o total do rateio, e é isso que a bateria acima não cobria.
    for (const criterio of ['valor', 'quantidade'] as const) {
      const r = custearNota({
        itens: [
          item({ insumoId: 'a', qtdCompra: 1e308, precoUnitario: 1 }),
          item({ insumoId: 'b', qtdCompra: 1e308, precoUnitario: 1 }),
        ],
        valorFrete: 1,
        politica: { ...POLITICA_PADRAO, criterioRateioFrete: criterio },
      })
      const naoFinito = r.itens.some(
        (i) => !Number.isFinite(i.custoTotal) || !Number.isFinite(i.custoUnitarioFinal) || !Number.isFinite(i.freteRateado),
      )
      expect(naoFinito).toBe(false)
      expect(r.erros.length).toBeGreaterThan(0)
      if (r.itens.length > 0) {
        const somaFretes = r.itens.reduce((s, i) => s + i.freteRateado, 0)
        expect(somaFretes).toBeCloseTo(1, 6)
      }
    }
  })

  // A soma dos PESOS estoura dentro do ratearFrete -> cada parcela sai finita E ZERO, e o
  // frete INTEIRO some. Checar `Number.isFinite` em cada parcela NÃO pega isto.
  it('frete que some por overflow da soma dos pesos é erro DURO', () => {
    for (const criterio of ['valor', 'quantidade'] as const) {
      const r = custearNota({
        itens: [
          item({ insumoId: 'a', qtdCompra: 1e308, precoUnitario: 1 }),
          item({ insumoId: 'b', qtdCompra: 1e308, precoUnitario: 1 }),
        ],
        valorFrete: 1,
        politica: { ...POLITICA_PADRAO, criterioRateioFrete: criterio },
      })
      expect(r.erros.length).toBeGreaterThan(0)
      expect(r.itens).toEqual([])
    }
  })

  // Um item descartado DEPOIS do rateio deixaria os sobreviventes com parcelas calculadas
  // sobre um conjunto que não existe mais. Agora o rateio roda UMA vez, sobre o conjunto final.
  it('item descartado não deixa o sobrevivente com uma parcela de frete velha', () => {
    const r = custearNota({
      itens: [
        item({ insumoId: 'gordo', qtdCompra: 1e300, fatorConversao: 1e300 }),  // qtdConsumo -> Infinity
        item({ insumoId: 'bom', qtdCompra: 2, precoUnitario: 50 }),
      ],
      valorFrete: 100,
      politica: POLITICA_PADRAO,
    })
    expect(r.erros.length).toBeGreaterThan(0)
    expect(r.itens.map((i) => i.insumoId)).toEqual(['bom'])
    // 'bom' é o único item custeável, então leva o frete INTEIRO — não uma sobra de 1e-298.
    expect(r.itens[0].freteRateado).toBeCloseTo(100, 10)
    expect(r.itens[0].custoTotal).toBeCloseTo(200, 10)
  })

  // Um item cujo PESO estoura (operandos finitos, produto Infinity) envenenava o `total`
  // do rateio e zerava o frete do item BOM, sem erro nenhum.
  it('item com peso que estoura NÃO rouba o frete do item bom', () => {
    const r = custearNota({
      itens: [
        item({ insumoId: 'estoura', qtdCompra: 1e308, precoUnitario: 10 }),
        item({ insumoId: 'bom', qtdCompra: 2, precoUnitario: 50 }),
      ],
      valorFrete: 100,
      politica: POLITICA_PADRAO,
    })
    expect(r.erros.length).toBeGreaterThan(0)
    expect(r.itens.map((i) => i.insumoId)).toEqual(['bom'])
    expect(r.itens[0].freteRateado).toBeCloseTo(100, 10)
    expect(Number.isFinite(r.itens[0].custoTotal)).toBe(true)
  })

  // REGRESSÃO: guardar os OPERANDOS não guarda o DENOMINADOR. 1e-200 × 1e-200 faz
  // underflow para 0, e a divisão por zero volta a ser alcançável.
  it('quantidade que faz underflow para zero é erro DURO', () => {
    const r = custearNota({
      itens: [item({ insumoId: 'micro', qtdCompra: 1e-200, fatorConversao: 1e-200 })],
      valorFrete: 0, politica: POLITICA_PADRAO,
    })
    expect(r.itens).toEqual([])
    expect(r.erros.length).toBeGreaterThan(0)
  })

  // Um item que passa a fase 1, ENTRA NO RATEIO, e só então estoura na fase 3 (fator
  // denormal -> qtdConsumo denormal -> o quociente estoura). Descartá-lo e seguir deixaria
  // o vizinho com metade de um frete que agora é todo dele. Por isso a recusa é GLOBAL.
  it('item que estoura DEPOIS do rateio recusa a nota inteira', () => {
    const r = custearNota({
      itens: [
        item({ insumoId: 'ruim', qtdCompra: 10, precoUnitario: 10, fatorConversao: 5e-324 }),
        item({ insumoId: 'bom', qtdCompra: 2, precoUnitario: 50 }),
      ],
      valorFrete: 100,
      politica: POLITICA_PADRAO,
    })
    expect(r.erros.length).toBeGreaterThan(0)
    // NENHUM item custeado: o rateio da fase 2 incluiu 'ruim', então a parcela de 'bom'
    // está calculada sobre um conjunto que não existe mais.
    expect(r.itens).toEqual([])
  })

  // A política pode mandar IGNORAR o frete. Se o `valorFrete` que chegou é lixo mas
  // nunca vai entrar em nenhuma conta, recusar a nota inteira por causa dele recusaria
  // itens provadamente bons.
  it('frete não-finito é IGNORADO quando a política não inclui frete', () => {
    const politica: PoliticaCusto = { ...POLITICA_PADRAO, incluirFrete: false }
    const r = custearNota({
      itens: [item({ insumoId: 'bom', qtdCompra: 10, precoUnitario: 10 })],
      valorFrete: NaN,
      politica,
    })
    expect(r.erros).toEqual([])
    expect(r.itens.map((i) => i.insumoId)).toEqual(['bom'])
    expect(r.itens[0].freteRateado).toBe(0)
    expect(r.itens[0].custoTotal).toBeCloseTo(100, 10)
  })
})
