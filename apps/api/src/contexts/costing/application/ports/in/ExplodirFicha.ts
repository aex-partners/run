import { Result } from '@/shared/kernel/Result'
// custoMateriais = MATERIAIS (o que vai para produtos.preco_custo, semântica Bling).
// custoTotal     = CHEIO: materiais + MOD + indireto (produtos.custo_unitario_total).
export interface ExplosaoResumo {
  skuId: string
  custoMateriais: number
  custoMod: number
  custoIndireto: number
  custoTotal: number
  tempoTotalMin: number
  linhas: number
  erros: string[]
  manuaisPreservados: number
}
export interface ExplodirFichaCommand { skuId: string; forcar?: boolean }
export interface ExplodirFicha { execute(cmd: ExplodirFichaCommand): Promise<Result<ExplosaoResumo>> }
