import { Result } from '@/shared/kernel/Result'

export interface CreateFolderCommand {
  ownerId: string
  name: string
  parentId?: string | null
}

export interface CreateFolder {
  execute(cmd: CreateFolderCommand): Promise<Result<{ id: string }>>
}
