import { FileShare, FileAccess } from '@/contexts/files/domain/FileShare'
import { FileShareId } from '@/contexts/files/domain/ids'

// Mirrors the AEX `file_shares` table.
export interface FileShareRow {
  id: string
  fileId: string
  userId: string
  access: string
  createdAt: Date
}

export interface FileShareValues {
  id: string
  fileId: string
  userId: string
  access: FileAccess
}

const asAccess = (raw: string): FileAccess => (raw === 'editor' ? 'editor' : 'viewer')

export const FileShareMapper = {
  toValues(share: FileShare): FileShareValues {
    return {
      id: share.id.value,
      fileId: share.fileId.value,
      userId: share.userId,
      access: share.access,
    }
  },

  toDomain(row: FileShareRow): FileShare {
    return FileShare.rehydrate(FileShareId.of(row.id), {
      fileId: row.fileId,
      userId: row.userId,
      access: asAccess(row.access),
      createdAt: row.createdAt,
    })
  },
}
