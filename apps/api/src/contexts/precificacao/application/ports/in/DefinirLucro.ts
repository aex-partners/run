import { Result } from '@/shared/kernel/Result'
export interface DefinirLucro {
  execute(cmd: { modeloId: string; canalId: string; lucroAlvo: number }): Promise<Result<{ id: string }>>
}
