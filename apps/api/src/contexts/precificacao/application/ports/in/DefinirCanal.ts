import { Result } from '@/shared/kernel/Result'
export interface DefinirCanal {
  execute(cmd: { id?: string; nome: string; comissao: number; frete?: number; ativo?: boolean }): Promise<Result<{ id: string }>>
}
