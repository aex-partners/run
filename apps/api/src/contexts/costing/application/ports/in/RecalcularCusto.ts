import { Result } from '@/shared/kernel/Result'

// Três formas da MESMA operação: um SKU, todos os SKUs de um modelo, ou uma LISTA
// explícita (que é o retorno do CustosDesatualizados). É o ÚNICO caminho pelo qual o
// custo de um produto muda: nada recalcula em cascata.
export interface RecalcularCusto {
  execute(cmd: { skuId?: string; modeloId?: string; skuIds?: string[] }): Promise<Result<{ recalculados: number }>>
}
