import { Result } from '@/shared/kernel/Result'
import { FileAccess } from '@/contexts/files/domain/FileShare'

// Maps to `files.share.changeAccess`.
export interface ChangeShareAccessCommand {
  fileId: string
  userId: string
  access: FileAccess
}

export interface ChangeShareAccess {
  execute(cmd: ChangeShareAccessCommand): Promise<Result<{ success: true }>>
}
