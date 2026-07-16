import { Result } from '@/shared/kernel/Result'
// `canal`/`condicao` carregam o NOME resolvido (com o id como fallback defensivo); `canalId`/
// `condicaoId` carregam o id cru, para quem já lia o id (ex.: uma nova geração de preços).
export interface PrecoLinha {
  canalId: string
  canal: string
  condicaoId: string
  condicao: string
  preco: number
  lucroUsado: number
}
export interface ConsultarPreco {
  execute(q: { skuId: string }): Promise<Result<{ skuId: string; custoBase: number; precos: PrecoLinha[] }>>
}
