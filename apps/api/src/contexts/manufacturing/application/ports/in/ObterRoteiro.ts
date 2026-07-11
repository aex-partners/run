export interface RoteiroOperacaoView {
  id: string
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
