import { Result } from '@/shared/kernel/Result'

// A NOTA É QUEM RECEBE. Não existe etapa de recebimento físico separada: lançar a nota
// move o estoque E define o custo. Um pedido pode receber VÁRIAS notas (entrega parcial),
// e `pedidoId` é opcional (compra direta, sem pedido, é normal).
export interface LancarNotaEntradaCommand {
  numero: string
  serie?: string
  fornecedorId: string
  pedidoId?: string | null
  dataEmissao: string
  dataEntrada: string
  depositoId: string
  valorFrete?: number
  condicaoPagamento?: string
  chaveNfe?: string
  // Em unidade de COMPRA. A conversão para unidade de CONSUMO acontece no motor
  // (domain/CustoNota.ts), usando `produtos.fator_conversao`.
  itens: {
    insumoId: string
    qtd: number
    precoUnitario: number
    desconto?: number
    imposto?: number
  }[]
}

export interface NotaResumo {
  notaId: string
  valorTotal: number
  itens: {
    insumoId: string
    qtdCompra: number
    qtdConsumo: number
    freteRateado: number
    custoUnitarioFinal: number   // unidade de CONSUMO
    custoMedioApos: number       // o médio do insumo DEPOIS desta entrada
  }[]
  // Avisos SUAVES: a nota FOI lançada (o material chegou, o estoque moveu), mas algo merece
  // atenção — um item que não bateu com o pedido, ou um erro suave devolvido pelo estoque
  // (ex.: a projeção de custo_medio/preco_custo falhou depois do movimento). Nunca impedem o
  // lançamento; só precisam ficar visíveis.
  avisos: string[]
}

export interface LancarNotaEntrada {
  execute(cmd: LancarNotaEntradaCommand): Promise<Result<NotaResumo>>
}
