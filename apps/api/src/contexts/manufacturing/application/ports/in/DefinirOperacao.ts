import { Result } from '@/shared/kernel/Result'

export interface DefinirOperacao {
  execute(cmd: {
    id?: string
    modeloId: string
    seq: number
    nome: string
    centroId: string | null
    tempoPadraoMin: number
    tempoPorTamanho?: Record<string, number>
    tempoSetupMin?: number
    loteSetup?: number
    agregada?: boolean
  }): Promise<Result<{ id: string }>>
}
