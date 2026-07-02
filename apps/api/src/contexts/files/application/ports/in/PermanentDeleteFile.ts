import { Result } from '@/shared/kernel/Result'

// Hard delete: removes the row and the bytes from storage.
export interface PermanentDeleteFileCommand {
  id: string
}

export interface PermanentDeleteFile {
  execute(cmd: PermanentDeleteFileCommand): Promise<Result<{ success: true }>>
}
