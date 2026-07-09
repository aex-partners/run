import { Result } from '@/shared/kernel/Result'
export interface RecalcularCusto {
  execute(cmd: { skuId?: string; modeloId?: string }): Promise<Result<{ recalculados: number }>>
}
