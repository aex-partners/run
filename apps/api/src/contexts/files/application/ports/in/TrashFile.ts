import { Result } from '@/shared/kernel/Result'

// Soft-delete: stamps deletedAt. Maps to the source `files.delete` procedure.
export interface TrashFileCommand {
  id: string
}

export interface TrashFile {
  execute(cmd: TrashFileCommand): Promise<Result<{ success: true }>>
}
