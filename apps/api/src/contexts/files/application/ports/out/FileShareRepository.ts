import { FileShare } from '@/contexts/files/domain/FileShare'
import { FileShareId, FileId } from '@/contexts/files/domain/ids'

export interface FileShareRepository {
  nextId(): FileShareId
  findByFileAndUser(fileId: FileId, userId: string): Promise<FileShare | null>
  save(share: FileShare): Promise<void>
  delete(share: FileShare): Promise<void>
}
