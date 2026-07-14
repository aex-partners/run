import { Result } from '@/shared/kernel/Result'

export interface PedidoView {
  pedidoId: string
  numero: string
  fornecedorId: string
  data: string
  status: string
  valorTotal: number
  itens: {
    insumoId: string
    qtd: number
    precoUnitario: number
    qtdRecebida: number
  }[]
}

export interface ConsultarPedidoCompra {
  execute(q: { pedidoId: string }): Promise<Result<PedidoView>>
}
