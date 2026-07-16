import { Result } from '@/shared/kernel/Result'
export interface DefinirParametros {
  execute(cmd: { imposto: number; iss?: number }): Promise<Result<{ id: string }>>
}
