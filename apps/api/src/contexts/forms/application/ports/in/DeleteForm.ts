import { Result } from '@/shared/kernel/Result'

export interface DeleteFormCommand {
  id: string
}

export interface DeleteForm {
  execute(cmd: DeleteFormCommand): Promise<Result<{ success: boolean }>>
}
