import { Result } from '@/shared/kernel/Result'

export interface SkuDefasado {
  skuId: string
  modeloId: string
  // Quando o custo do SKU foi calculado. `null` = nunca teve snapshot.
  snapshotEm: string | null
  // A data mais recente em que o custo médio de algum insumo da ficha dele mudou.
  insumoAtualizadoEm: string
  // Os insumos cujo custo mudou depois do snapshot.
  insumos: string[]
}

// READONLY, calculado na hora. É a resposta ao problema criado (de propósito) pela regra
// "o custo do produto NUNCA muda automaticamente": sem isto, a ficha continuaria dizendo
// um custo velho e ninguém descobriria até vender errado.
//
// Compara a data do último snapshot de custo do SKU contra `produtos.custo_medio_atualizado_em`
// dos insumos da ficha explodida dele. Zero escrita, zero cascata: o sistema AVISA, o
// usuário DECIDE (chamando recalcular_custo com a lista).
export interface CustosDesatualizados {
  // `truncado: true` = alguma consulta bateu no teto de 500 do engine e há SKUs que não
  // foram avaliados. Declarado em vez de silenciado.
  execute(q: { modeloId?: string }): Promise<Result<{ skus: SkuDefasado[]; truncado: boolean }>>
}
