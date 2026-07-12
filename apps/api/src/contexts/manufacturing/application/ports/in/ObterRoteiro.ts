// ATENÇÃO: esta forma é espelhada, ESTRUTURALMENTE, pelo out-port RoteiroProvider do costing
// (RoteiroOperacao/RoteiroCentro/RoteiroPublicadoView). É o que permite à ponte ACL
// ManufacturingRoteiroProvider casar as duas com um `ObterRoteiroLike` LOCAL, sem import
// cross-context. Mudou um campo aqui, mude lá também — senão a composition root não compila.
export interface RoteiroOperacaoView {
  id: string
  // Identidade ESTÁVEL da operação no modelo. O costing casa a atribuição da linha da ficha
  // (fichas_tecnicas.operacao_codigo) com a operação do roteiro por AQUI, não pelo `id`.
  codigo: string
  seq: number
  centroId: string | null
  tempoPadraoMin: number
  tempoPorTamanho: Record<string, number>
  tempoSetupMin: number
  loteSetup: number
}

export interface RoteiroCentroView {
  id: string
  custoMinMod: number | null
}

export interface RoteiroView {
  modeloId: string
  rev: number
  operacoes: RoteiroOperacaoView[]
  centros: RoteiroCentroView[]
}

export interface ObterRoteiro {
  execute(q: { modeloId: string }): Promise<RoteiroView | null>
}
