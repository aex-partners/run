import { FlowFolder } from '@/contexts/automation/domain/FlowFolder'
import { FlowFolderId } from '@/contexts/automation/domain/ids'

export interface FlowFolderRow {
  id: string
  displayName: string
  displayOrder: number
  createdAt: Date
}

export const FlowFolderMapper = {
  toPersistence(folder: FlowFolder): FlowFolderRow {
    return {
      id: folder.id.value,
      displayName: folder.displayName,
      displayOrder: folder.displayOrder,
      createdAt: folder.createdAt,
    }
  },

  toDomain(row: FlowFolderRow): FlowFolder {
    return FlowFolder.rehydrate({
      id: FlowFolderId.of(row.id),
      displayName: row.displayName,
      displayOrder: row.displayOrder,
      createdAt: row.createdAt,
    })
  },
}
