import { Result } from '@/shared/kernel/Result'

// The folder mutation in-ports (`flows.createFolder` / `deleteFolder` /
// `renameFolder` / `reorderFolders`). Grouped in one file as they form a single
// small CRUD surface fulfilled by one service.

export interface CreateFolder {
  execute(cmd: { displayName: string }): Promise<Result<{ id: string }>>
}

export interface DeleteFolder {
  execute(cmd: { id: string }): Promise<Result<{ success: true }>>
}

export interface RenameFolder {
  execute(cmd: { id: string; displayName: string }): Promise<Result<{ success: true }>>
}

export interface ReorderFolders {
  execute(cmd: { folderIds: string[] }): Promise<Result<{ success: true }>>
}
