import { Result } from '@/shared/kernel/Result'

export interface DefinirCentro {
  execute(cmd: {
    id?: string
    nome: string
    setor: string
    custoMinMod: number
    capacidadeMinDia?: number
    numOperadores?: number
    ativo?: boolean
  }): Promise<Result<{ id: string }>>
}
