import { FileSource } from '@/contexts/files/domain/FileSource'

// Read side (CQRS). Bypasses the domain: an adapter answers with a single
// scoped, filtered, paginated query against the files table and shapes the row
// into the screen's view model (formatted size, preview/download URLs).
export type FileCategory = 'all' | 'starred' | 'recent' | 'shared' | 'trash'
export type FileSourceFilter = 'all' | FileSource

export interface ListFilesOptions {
  ownerId: string
  parentId?: string | null
  category: FileCategory
  source: FileSourceFilter
  search?: string
  limit: number
  offset: number
}

export interface FileListItem {
  id: string
  name: string
  type: string
  size: string
  modifiedAt: string
  source: FileSource
  sourceRef: string | null
  starred: boolean
  shared: boolean
  isFolder: boolean
  parentId: string | null
  aiIndexed: boolean
  previewUrl: string | null
  downloadUrl: string | null
}

export interface ListFiles {
  execute(opts: ListFilesOptions): Promise<FileListItem[]>
}
