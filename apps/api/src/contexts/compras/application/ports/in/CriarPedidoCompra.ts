import { Result } from '@/shared/kernel/Result'

export interface CriarPedidoCompraCommand {
  numero: string
  fornecedorId: string
  data: string
  previsaoEntrega?: string
  observacao?: string
  // Em unidade de COMPRA (é o que o fornecedor fatura).
  itens: { insumoId: string; qtd: number; precoUnitario: number }[]
}

export interface CriarPedidoCompra {
  execute(cmd: CriarPedidoCompraCommand): Promise<Result<{ pedidoId: string; valorTotal: number }>>
}
