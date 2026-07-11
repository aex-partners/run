import { Result } from '@/shared/kernel/Result'

export interface DefinirTaxaCusto {
  execute(cmd: {
    chave: string
    valor: number
    centroId?: string | null
    vigenciaInicio: string
    vigenciaFim?: string | null
  }): Promise<Result<{ id: string }>>
}
