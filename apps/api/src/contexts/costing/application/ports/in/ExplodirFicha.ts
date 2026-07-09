import { Result } from '@/shared/kernel/Result'
export interface ExplosaoResumo { skuId: string; custoTotal: number; linhas: number; erros: string[]; manuaisPreservados: number }
export interface ExplodirFichaCommand { skuId: string; forcar?: boolean }
export interface ExplodirFicha { execute(cmd: ExplodirFichaCommand): Promise<Result<ExplosaoResumo>> }
