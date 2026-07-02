import { Result } from '@/shared/kernel/Result'

export interface MoveFileCommand {
  id: string
  parentId: string | null
}

export interface MoveFile {
  execute(cmd: MoveFileCommand): Promise<Result<{ success: true }>>
}
