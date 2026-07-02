import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import {
  CreateFolder,
  DeleteFolder,
  RenameFolder,
  ReorderFolders,
} from '@/contexts/automation/application/ports/in/Folders'
import { FlowFolderRepository } from '@/contexts/automation/application/ports/out/FlowFolderRepository'
import { FlowFolder } from '@/contexts/automation/domain/FlowFolder'
import { FlowFolderId } from '@/contexts/automation/domain/ids'

// One service backing the four small folder use cases. The named methods do the
// work; the factory helpers below expose each as its own in-port so the controller
// stays one-handler-per-procedure.
export class FolderService {
  constructor(
    private readonly folders: FlowFolderRepository,
    private readonly clock: Clock,
  ) {}

  async create(cmd: { displayName: string }): Promise<Result<{ id: string }>> {
    const folder = FlowFolder.create({
      id: this.folders.nextId(),
      displayName: cmd.displayName,
      now: this.clock.now(),
    })
    await this.folders.save(folder)
    return ok({ id: folder.id.value })
  }

  async remove(cmd: { id: string }): Promise<Result<{ success: true }>> {
    await this.folders.delete(FlowFolderId.of(cmd.id))
    return ok({ success: true })
  }

  async rename(cmd: { id: string; displayName: string }): Promise<Result<{ success: true }>> {
    const folder = await this.folders.findById(FlowFolderId.of(cmd.id))
    if (!folder) return fail('RenameFolder: folder not found')
    folder.rename(cmd.displayName)
    await this.folders.save(folder)
    return ok({ success: true })
  }

  async reorder(cmd: { folderIds: string[] }): Promise<Result<{ success: true }>> {
    for (let index = 0; index < cmd.folderIds.length; index++) {
      const folder = await this.folders.findById(FlowFolderId.of(cmd.folderIds[index]!))
      if (!folder) continue
      folder.reorder(index)
      await this.folders.save(folder)
    }
    return ok({ success: true })
  }
}

export const createFolderPort = (s: FolderService): CreateFolder => ({ execute: (c) => s.create(c) })
export const deleteFolderPort = (s: FolderService): DeleteFolder => ({ execute: (c) => s.remove(c) })
export const renameFolderPort = (s: FolderService): RenameFolder => ({ execute: (c) => s.rename(c) })
export const reorderFoldersPort = (s: FolderService): ReorderFolders => ({ execute: (c) => s.reorder(c) })
