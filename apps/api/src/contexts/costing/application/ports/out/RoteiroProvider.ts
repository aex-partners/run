// OUT-PORT (ACL): o costing precisa do roteiro PUBLICADO de um modelo para custear a
// conversão, mas NUNCA importa o contexto manufacturing. Esta é a forma que o costing
// exige; quem a satisfaz (bridge real ou fake) é decidido na composition root.
// Tempos SEMPRE em minutos. Estrutura espelha a in-port ObterRoteiro do manufacturing.

export interface RoteiroOperacao {
  id: string
  seq: number
  centroId: string | null
  tempoPadraoMin: number
  tempoPorTamanho: Record<string, number>
  tempoSetupMin: number
  loteSetup: number
}

export interface RoteiroCentro {
  id: string
  custoMinMod: number | null
}

export interface RoteiroPublicadoView {
  modeloId: string
  rev: number
  operacoes: RoteiroOperacao[]
  centros: RoteiroCentro[]
}

export interface RoteiroProvider {
  // null = o modelo não tem roteiro publicado (soft failure: custo de materiais continua válido).
  roteiroPublicado(modeloId: string): Promise<RoteiroPublicadoView | null>
}
