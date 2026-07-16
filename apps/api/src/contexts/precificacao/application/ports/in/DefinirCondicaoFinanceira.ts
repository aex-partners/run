import { Result } from '@/shared/kernel/Result'
export interface DefinirCondicaoFinanceira {
  execute(cmd: { condicaoId: string; despFinanceira: number }): Promise<Result<{ id: string }>>
}
