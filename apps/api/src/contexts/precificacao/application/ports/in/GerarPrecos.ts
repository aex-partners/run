import { Result } from '@/shared/kernel/Result'
export interface GerarPrecos {
  execute(cmd: { skuId?: string; modeloId?: string; skuIds?: string[] }): Promise<Result<{ gravados: number; erros: string[] }>>
}
