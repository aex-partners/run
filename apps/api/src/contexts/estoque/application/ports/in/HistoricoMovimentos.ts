import { Result } from '@/shared/kernel/Result'

export interface MovimentoView {
  id: string
  tipo: string
  qtd: number
  custoUnitario: number
  data: string
  depositoId: string
  origemTipo: string | null
  origemId: string | null
  saldoTotalApos: number
  custoMedioApos: number
  observacao: string | null
}

export interface HistoricoMovimentos {
  // `truncado: true` significa que a consulta BATEU no teto do engine (500) e há
  // movimentos mais antigos que NÃO vieram. Saturação silenciosa num livro contábil
  // é como um custo errado passa despercebido: aqui ela é declarada.
  execute(q: { insumoId: string; limite?: number }): Promise<Result<{ movimentos: MovimentoView[]; truncado: boolean }>>
}
