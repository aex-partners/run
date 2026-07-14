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
})
