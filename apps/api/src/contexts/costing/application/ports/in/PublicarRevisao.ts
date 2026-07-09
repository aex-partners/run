import { Result } from '@/shared/kernel/Result'
export interface PublicarRevisao {
  execute(cmd: { modeloId: string }): Promise<Result<{ rev: number }>>
}
