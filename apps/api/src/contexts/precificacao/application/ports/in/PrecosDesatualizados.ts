import { Result } from '@/shared/kernel/Result'
export interface PrecoDefasado { skuId: string; modeloId: string; precoEm: string | null; custoEm: string }
export interface PrecosDesatualizados {
  execute(q: { modeloId?: string }): Promise<Result<{ skus: PrecoDefasado[]; truncado: boolean }>>
}
