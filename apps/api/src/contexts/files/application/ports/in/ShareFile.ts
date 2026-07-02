import { Result } from '@/shared/kernel/Result'
import { FileAccess } from '@/contexts/files/domain/FileShare'

// Maps to `files.share.addUser`: resolve a user by email and grant access.
export interface ShareFileCommand {
  fileId: string
  email: string
  access: FileAccess
}

export interface ShareFile {
  execute(cmd: ShareFileCommand): Promise<Result<{ success: true }>>
}
