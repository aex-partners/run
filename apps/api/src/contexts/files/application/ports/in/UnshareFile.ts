import { Result } from '@/shared/kernel/Result'

// Maps to `files.share.removeUser`.
export interface UnshareFileCommand {
  fileId: string
  userId: string
}

export interface UnshareFile {
  execute(cmd: UnshareFileCommand): Promise<Result<{ success: true }>>
}
