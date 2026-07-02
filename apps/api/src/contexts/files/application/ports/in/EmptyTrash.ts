import { Result } from '@/shared/kernel/Result'

// Empties every trashed file owned by the caller, deleting their bytes too.
export interface EmptyTrashCommand {
  ownerId: string
}

export interface EmptyTrash {
  execute(cmd: EmptyTrashCommand): Promise<Result<{ deleted: number }>>
}
