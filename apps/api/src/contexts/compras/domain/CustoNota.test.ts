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
  // NENHUM custo não-finito sai daqui sem erro.
  it('nenhum custo não-finito escapa com a lista de erros vazia', () => {
    const venenos = [
      { qtdCompra: Infinity }, { qtdCompra: NaN }, { qtdCompra: -Infinity },
      { precoUnitario: Infinity }, { precoUnitario: NaN },
      { desconto: Infinity }, { desconto: NaN },
      { imposto: Infinity }, { imposto: NaN },
      { fatorConversao: Infinity }, { fatorConversao: NaN },
    ]
    for (const veneno of venenos) {
      for (const frete of [0, 100, NaN, Infinity]) {
        const r = custearNota({
          itens: [item(veneno), item({ insumoId: 'ok' })],
          valorFrete: frete,
          politica: POLITICA_PADRAO,
        })
        const naoFinito = r.itens.some(
          (i) => !Number.isFinite(i.custoTotal) || !Number.isFinite(i.custoUnitarioFinal) || !Number.isFinite(i.freteRateado),
        )
        // Se algum custo saiu não-finito, TEM que haver erro. E, de fato, nada não-finito
        // deveria sair: todo item custeado passou pela validação.
        expect(naoFinito).toBe(false)
        expect(r.erros.length).toBeGreaterThan(0)
      }
    }
  })
})
