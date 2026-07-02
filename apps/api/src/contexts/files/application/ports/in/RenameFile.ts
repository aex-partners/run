import { Result } from '@/shared/kernel/Result'

export interface RenameFileCommand {
  id: string
  name: string
}

export interface RenameFile {
  execute(cmd: RenameFileCommand): Promise<Result<{ success: true }>>
}
