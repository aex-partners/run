import { randomUUID } from 'node:crypto'
import { FlowFolderRepository } from '@/contexts/automation/application/ports/out/FlowFolderRepository'
import { FlowFolder } from '@/contexts/automation/domain/FlowFolder'
import { FlowFolderId } from '@/contexts/automation/domain/ids'

// In-memory test double for `flow_folders`.
export class InMemoryFlowFolderRepository implements FlowFolderRepository {
  private readonly folders = new Map<string, FlowFolder>()

  nextId(): FlowFolderId {
    return FlowFolderId.of(randomUUID())
  }

  async findById(id: FlowFolderId): Promise<FlowFolder | null> {
    return this.folders.get(id.value) ?? null
  }

  async save(folder: FlowFolder): Promise<void> {
    this.folders.set(folder.id.value, folder)
  }

  async delete(id: FlowFolderId): Promise<void> {
    this.folders.delete(id.value)
  }
}
