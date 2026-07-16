import { Result } from '@/shared/kernel/Result'
export interface PrecoLinha { canal: string; condicao: string; preco: number; lucroUsado: number }
export interface ConsultarPreco {
  execute(q: { skuId: string }): Promise<Result<{ skuId: string; custoBase: number; precos: PrecoLinha[] }>>
}
