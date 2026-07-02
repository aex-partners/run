import { FlowFolder } from '@/contexts/automation/domain/FlowFolder'
import { FlowFolderId } from '@/contexts/automation/domain/ids'

// Driven port for `flow_folders`.
export interface FlowFolderRepository {
  nextId(): FlowFolderId
  findById(id: FlowFolderId): Promise<FlowFolder | null>
  save(folder: FlowFolder): Promise<void>
  delete(id: FlowFolderId): Promise<void>
}
