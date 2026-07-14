import { describe, it, expect } from 'vitest'
import { aplicarEntrada, aplicarMovimentoSemCusto, custeia } from '@/contexts/estoque/domain/CustoMedio'

describe('CustoMedio', () => {
  // O GOLDEN. Se o motor errar isto, erra tudo.
  it('pondera duas entradas: 100 a R$10 + 100 a R$20 = médio R$15', () => {
    let e = { saldo: 0, custoMedio: 0 }
    e = aplicarEntrada(e, 100, 10)
    expect(e).toEqual({ saldo: 100, custoMedio: 10 })
    e = aplicarEntrada(e, 100, 20)
    expect(e.saldo).toBe(200)
    expect(e.custoMedio).toBeCloseTo(15, 10)
  })

  it('saída NÃO muda o custo médio', () => {
    const e = aplicarMovimentoSemCusto({ saldo: 200, custoMedio: 15 }, -50)
    expect(e).toEqual({ saldo: 150, custoMedio: 15 })
  })

  it('pondera com quantidades desiguais', () => {
    // 30 a R$10 + 70 a R$20 = (300 + 1400) / 100 = 17
    let e = aplicarEntrada({ saldo: 0, custoMedio: 0 }, 30, 10)
    e = aplicarEntrada(e, 70, 20)
    expect(e.custoMedio).toBeCloseTo(17, 10)
  })

  // BORDA: ponderar contra saldo ZERO daria 0/0. A entrada DEFINE o médio.
  it('saldo zero na entrada: o custo da entrada vira o médio', () => {
    expect(aplicarEntrada({ saldo: 0, custoMedio: 99 }, 10, 7))
      .toEqual({ saldo: 10, custoMedio: 7 })
  })

  // BORDA: ponderar contra saldo NEGATIVO produz um médio sem sentido (negativo ou
  // explodido). A entrada define o médio, e o saldo continua sendo corrigido.
  it('saldo negativo na entrada: o custo da entrada vira o médio, sem ponderar', () => {
    expect(aplicarEntrada({ saldo: -20, custoMedio: 15 }, 50, 8))
      .toEqual({ saldo: 30, custoMedio: 8 })
  })

  it('entrada com quantidade zero ou negativa não muda nada', () => {
    const e = { saldo: 100, custoMedio: 10 }
    expect(aplicarEntrada(e, 0, 999)).toEqual(e)
    expect(aplicarEntrada(e, -5, 999)).toEqual(e)
  })

  // Saída maior que o saldo é PERMITIDA (bloquear trava a fábrica). O saldo fica
  // negativo, o médio não muda, e quem avisa é o serviço (erro suave).
  it('saída maior que o saldo deixa saldo negativo e preserva o médio', () => {
    expect(aplicarMovimentoSemCusto({ saldo: 10, custoMedio: 15 }, -30))
      .toEqual({ saldo: -20, custoMedio: 15 })
  })

  it('quantidade fracionária (1,3 mt de tecido) pondera certo', () => {
    let e = aplicarEntrada({ saldo: 0, custoMedio: 0 }, 1.3, 15)
    e = aplicarEntrada(e, 2.7, 25)
    // (1,3 × 15 + 2,7 × 25) / 4 = (19,5 + 67,5) / 4 = 21,75
    expect(e.saldo).toBeCloseTo(4, 10)
    expect(e.custoMedio).toBeCloseTo(21.75, 10)
  })

  describe('custeia', () => {
    it('SÓ entrada_nota e inventario_abertura mudam o custo médio', () => {
      expect(custeia('entrada_nota')).toBe(true)
      expect(custeia('inventario_abertura')).toBe(true)
      for (const t of ['ajuste', 'contagem', 'devolucao_fornecedor', 'saida_manual']) {
        expect(custeia(t)).toBe(false)
      }
    })

    // Fases 2 e 3 acrescentam consumo_producao / saida_venda: são SAÍDAS, ao médio vigente.
    it('um tipo desconhecido não custeia (default seguro)', () => {
      expect(custeia('consumo_producao')).toBe(false)
      expect(custeia('qualquer_coisa')).toBe(false)
    })
  })
})
