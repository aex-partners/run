import { Result } from '@/shared/kernel/Result'

export interface PublicarRoteiro {
  execute(cmd: { modeloId: string }): Promise<Result<{ rev: number }>>
}
