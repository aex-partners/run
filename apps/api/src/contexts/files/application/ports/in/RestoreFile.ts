import { Result } from '@/shared/kernel/Result'

export interface RestoreFileCommand {
  id: string
}

export interface RestoreFile {
  execute(cmd: RestoreFileCommand): Promise<Result<{ success: true }>>
}
