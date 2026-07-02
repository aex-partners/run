import { Result } from '@/shared/kernel/Result'

export interface DeleteEntityCommand {
  entityId: string
}

export interface DeleteEntity {
  execute(cmd: DeleteEntityCommand): Promise<Result<{ ok: true }>>
}
